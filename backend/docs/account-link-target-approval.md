# Account Link — Target Approval Architecture

Design for replacing one-tap `POST /api/auth/link-provider` with a two-sided link request: **initiator proposes**, **target approves via central-auth magic link**, then the pending provider identity is written to `user_identities`.

UI mockup: `frontend/docs/link-account-target-approval-mockup.html`.

Related today:

- Schema: `user_identities`, `account_merge_requests` (`backend/docs/backend-schema-mvp.md`)
- Flow: Integrated Accounts (`backend/docs/backend-flows.md`)
- Code: `EnsureCentralUser`, `LinkProvider` (`backend/internal/auth/central_user.go`)
- Email / magic link: `central-auth` (`CreateMagicLink`, `SendMagicLink`, `CompleteMagicLink`, `MAGIC_LINK_TTL` default **15m**)

**Out of scope:** account *merge* (two `users` rows). Keep `account_merge_requests` separate.

---

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Request TTL | **15 minutes** (align with central-auth `MAGIC_LINK_TTL`) |
| Target proof | **Reuse central-auth magic link** (existing email verification / sign-in mailer) |
| OTP in Project PN | **No** — do not add a second email/OTP system |
| Mail sending | **central-auth only** (`SMTP_*` / Resend already configured there) |
| Confirm auth | Bearer/cookie session after magic-link completion; provider must be email (`magic_link` / `nacfson`), not the pending provider |

---

## 1. Problem

Current same-email link:

1. User signs in with provider B (e.g. Google).
2. `EnsureCentralUser` finds existing user by email (provider A already linked).
3. Session binds to that user and returns `link_recommendation` + in-memory `PendingIdentity`.
4. `POST /api/auth/link-provider` inserts B into `user_identities` **using only the initiator session**.

Only one side consents. Target never proves inbox control.

---

## 2. Roles and invariants

| Role | Meaning in same-email link |
|------|----------------------------|
| **Anchor user** | Existing `users` row matched by verified email. Already has at least one identity. |
| **Pending identity** | Current session’s `(provider, provider_subject)` not yet in `user_identities`. |
| **Initiator** | Session that creates the link request (holds the pending identity proof, e.g. Google). |
| **Target** | Inbox for the anchor email — proven by completing **central-auth magic link**. |

### Invariants

1. Initiator alone must never complete a link.
2. Target proof is a **fresh central-auth magic link** (single-use token, 15m TTL) for the anchor email.
3. Pending `(provider, provider_subject)` is copied onto the request at propose time from the session — never from client body.
4. Email on the request equals the anchor user’s normalized email.
5. At most one **pending** link request per `(user_id, pending_provider)`.
6. Confirm session must be **email magic-link auth** (`auth_provider` → PN `nacfson`), email must match the request, and session provider must **not** equal `pending_provider`.
7. Completing a link inserts `user_identities` and respects existing unique indexes.
8. `POST /api/auth/link-provider` is removed or hard-fails — no silent legacy path.

---

## 3. State machine

```text
                    ┌─────────────┐
         propose    │   pending   │
initiator ─────────►│  (≤ 15 min) │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     ┌──────────┐   ┌──────────┐   ┌────────────┐
     │ cancelled│   │ expired  │   │  completed │
     └──────────┘   └──────────┘   └────────────┘
```

| Status | Meaning |
|--------|---------|
| `pending` | Magic link sent (or ready to send); awaiting target. |
| `completed` | Target confirmed; `user_identities` written; terminal. |
| `cancelled` | Initiator cancelled or target declined; terminal. |
| `expired` | `expires_at < now()` while still pending; terminal (lazy). |

**TTL:** `expires_at = now() + 15 minutes` on create and on resend (resend rotates expiry and triggers a new magic link).

---

## 4. Data model

### New table: `account_link_requests`

No OTP / approve-token columns — proof lives in central-auth `magic_link_tokens`.

```sql
account_link_requests
- id                       uuid PK default gen_random_uuid()
- user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
- initiated_by_user_id     uuid NOT NULL REFERENCES users(id)
- pending_provider         text NOT NULL          -- 'google' | 'nacfson'
- pending_provider_subject text NOT NULL
- pending_email            text NOT NULL          -- normalized
- status                   text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'completed', 'cancelled', 'expired'))
- approval_method          text                   -- set on success: 'central_magic_link'
- expires_at               timestamptz NOT NULL
- completed_at             timestamptz
- cancelled_at             timestamptz
- created_at               timestamptz NOT NULL DEFAULT now()
```

```sql
CREATE UNIQUE INDEX account_link_requests_one_pending
  ON account_link_requests (user_id, pending_provider)
  WHERE status = 'pending';

CREATE INDEX account_link_requests_user_status_idx
  ON account_link_requests (user_id, status);
```

### Unchanged

- `user_identities` — written only on successful confirm.
- `account_merge_requests` — different-email / two-user merge.
- central-auth `magic_link_tokens` — existing table; default TTL already 15m.

---

## 5. Target approval = central-auth magic link

### Existing origin system (reuse as-is)

| Piece | Location |
|-------|----------|
| Create token | `session.Service.CreateMagicLink` → `magic_link_tokens` |
| Send email | `mail.Mailer.SendMagicLink` (SMTP or Resend) |
| Consume + session | `GET /auth/callback?token=…&rd=…` → `CompleteMagicLink` |
| TTL | `MAGIC_LINK_TTL` (default **15m**) |
| Public API | `POST /api/auth/magic-link` + `?rd=` |
| Form API | `POST /login/magic-link` |

PN does **not** store magic-link hashes or send mail.

### Redirect contract

On propose / resend, PN asks central-auth to send a magic link whose `rd` returns to the app approve surface:

```text
{APP_PUBLIC_URL}/link-approve?requestId=<account_link_requests.id>
```

Examples:

- Web: `https://pn.nacfson.cloud/link-approve?requestId=…`
- Local: `http://localhost:8081/link-approve?requestId=…`

After `CompleteMagicLink`, central-auth redirects to `rd` with session credentials (cookie for hosted web; `token` / `refresh_token` / `expires_at` for native — same as login).

### How PN triggers the email

**Recommended:** Project PN server calls central-auth (internal URL) so the client cannot spoof email:

```http
POST {CENTRAL_AUTH_INTERNAL_URL}/api/auth/magic-link?rd={urlencode(approve_rd)}
Content-Type: application/json

{ "email": "you@example.com" }
```

If the public magic-link route stays unauthenticated (today it is), prefer locking the internal call behind a shared service secret or network policy when adding this. Until then, PN backend still owns *when* the call happens (only after a valid link request is created).

**Optional central-auth enhancement (nice-to-have, not required for MVP):**

- Accept `purpose: "account_link"` on create for clearer email copy (“Approve linking Google…” vs “Sign in”).
- Same `magic_link_tokens` + mailer path; template branch only.

MVP can reuse the existing “sign-in” magic-link email copy; approve page copy explains linking.

### Confirm rule (PN)

`POST /api/auth/link-requests/{id}/confirm` (authenticated):

1. Load request; `status = pending`; `expires_at > now()`.
2. Session email (normalized) == `pending_email`.
3. Mapped session provider is **email** (`nacfson` / `magic_link`) — **not** `pending_provider`.
4. In one TX: insert `user_identities` from request’s pending fields; set `status = completed`, `approval_method = 'central_magic_link'`, `completed_at = now()`.

Reject if the caller is still on the Google (pending) session without completing magic link.

Decline: `POST /api/auth/link-requests/{id}/cancel` as initiator, or a logged-in target with email session calling cancel/decline.

---

## 6. HTTP API (Project PN)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/auth/link-requests` | Bearer (initiator + `PendingIdentity`) | Create pending row (15m); trigger central-auth magic link with approve `rd`. |
| `GET` | `/api/auth/link-requests/current` | Bearer | Active pending request or 204. |
| `POST` | `/api/auth/link-requests/{id}/resend` | Bearer (initiator) | Extend/rotate `expires_at` (+15m); send a **new** magic link. |
| `POST` | `/api/auth/link-requests/{id}/cancel` | Bearer (initiator or email target) | Cancel pending. |
| `POST` | `/api/auth/link-requests/{id}/confirm` | Bearer (**email magic-link session**) | Complete link; insert identity. |
| ~~`POST`~~ | ~~`/api/auth/link-provider`~~ | — | Remove or hard-fail. |

### `GET /api/auth/me`

Keep `link_recommendation`. Add:

```json
"link_request": {
  "id": "...",
  "status": "pending",
  "pending_provider": "google",
  "email": "you@example.com",
  "expires_at": "..."
}
```

### Create body

No client-supplied provider/subject/email. Server uses `PendingIdentity` from auth context only.

Response:

```json
{ "id": "...", "expires_at": "...", "email": "you@example.com" }
```

---

## 7. Sequence (happy path)

```text
Initiator (Google session, PendingIdentity=google)
    │
    │  POST /api/auth/link-requests
    ▼
PN API ── insert account_link_requests (expires_at = now+15m)
       ── POST central-auth /api/auth/magic-link
              email=anchor, rd=/link-approve?requestId=…
       ── central-auth mailer ──► inbox (existing magic-link email)
    │
    ▼
Initiator UI: “Check your email to approve (15 min)”

Target
    │  opens magic link
    ▼
central-auth GET /auth/callback?token=…&rd=…
    │  consumes magic_link_tokens, creates magic_link session
    │  redirect → /link-approve?requestId=… (+ session)
    ▼
PN app (nacfson / magic_link session)
    │  POST /api/auth/link-requests/{id}/confirm
    ▼
PN API ── verify email session ≠ pending provider
       ── INSERT user_identities(google, …)
       ── status=completed
```

---

## 8. Interaction with `EnsureCentralUser`

Unchanged detection path:

- Same email + missing provider → `link_recommendation` + `PendingIdentity`.
- Do **not** auto-insert identity.

Changes:

- Completion only via link-request confirm (not `LinkProvider` HTTP).
- Keep private insert helper for the confirm transaction.
- While pending, `me` returns `link_request`.
- After complete, identity lookup succeeds; recommendation clears.

Idempotent propose: if pending row exists for same provider, resend magic link and return existing id (or 409 — prefer resend-friendly idempotency).

---

## 9. Security checklist

- [ ] Magic-link tokens stay hashed in central-auth only; PN never logs raw tokens
- [ ] Link request TTL and magic-link TTL both **15m**; resend issues a **new** central-auth token
- [ ] Confirm rejects sessions whose provider == `pending_provider`
- [ ] Confirm rejects email mismatch
- [ ] Expired/cancelled requests cannot complete
- [ ] Provider subject conflict (already on another user) → 409, leave request pending or cancel with error
- [ ] Rate-limit propose/resend (e.g. 1 magic link / 60s / user)
- [ ] Approve page does not auto-confirm without an explicit **Approve** tap (avoid one-click email prefetch completing link)

---

## 10. Diff vs merge

| | Link request | Merge request |
|--|--------------|---------------|
| Rows | 1 user + 1 identity | 2 users → 1 |
| Target proof | Central-auth **magic link** (15m) | Logged-in target user |
| Mail | Reuse origin magic-link mailer | None today |
| Data move | Identity attach only | Union vocab; delete source |
| Table | `account_link_requests` | `account_merge_requests` |

---

## 11. Migration / rollout

1. PN migration: create `account_link_requests`.
2. Service + handlers; central-auth client method `SendMagicLink(email, redirectURL)`.
3. Remove/hard-fail `POST /link-provider`.
4. Frontend: notice → propose → pending → `/link-approve` after magic link → confirm.
5. Docs: overview, flows, schema, acceptance tests.
6. Tests:
   - Propose without `PendingIdentity` → 400
   - Propose triggers magic-link call (mock central client)
   - Confirm with Google (pending) session → 403/400
   - Confirm with magic_link session + matching email → identity inserted
   - Expired (15m) → reject
   - Resend rotates expiry and calls magic-link again

### Central-auth

**MVP:** no schema change; reuse `POST /api/auth/magic-link`.

**Follow-up (optional):** purpose-specific email subject/body for account link.

---

## 12. Implementation order

1. Schema + link-request service (mock mailer / fake central client in tests).
2. HTTP API; delete immediate `link-provider`.
3. Wire `CentralClient.SendMagicLink`.
4. Frontend against mockup (`/link-approve`).
5. Docs + acceptance tests.
