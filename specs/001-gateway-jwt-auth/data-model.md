# Data Model: Gateway JWT Auth Verification

**Feature**: `001-gateway-jwt-auth`  
**Date**: 2026-10-07

## Entities

### Local User (`users`)

Existing Project PN account. **Preserved** across cutover.

| Field | Notes |
|-------|--------|
| `id` | UUID PK — owns decks, `user_word_senses`, reviews |
| `email` | Unique informational contact; **not** platform identity key |
| languages / settings | Unchanged |

**Rules**:
- Learning ownership stays on `users.id`.
- Cutover MUST NOT truncate `users` or learning tables.
- **No application-admin authorization**: do not use `is_admin` (if column still exists historically) for product access control; prefer drop/ignore in migrations for this feature. No `admin_bindings` table.

### Platform Identity Binding (`user_identities` — evolved)

Maps Keycloak access-token identity → local user.

| Field | Type | Rules |
|-------|------|--------|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users` | Cascade on user delete |
| `issuer` | text | Exact Keycloak realm issuer URL (`iss`) |
| `subject` | text | Keycloak `sub` |
| `sign_in_method` | text | Live: `google` only; reserved: `apple`, `email` |
| `email_at_provider` | text nullable | Informational snapshot |
| `created_at` / `updated_at` | timestamptz | |

**Constraints**:
- `UNIQUE (issuer, subject)` — primary lookup key (FR-001, FR-014).
- `sign_in_method` allowlist includes `google` (and reserved `apple`, `email`); runtime this delivery only writes `google`.
- Index on `user_id` for listing linked methods.

**Migration from current schema** (`provider`, `provider_subject`):
1. Add `issuer`, `subject`, `sign_in_method` (or rename carefully).
2. Operator migration fills Keycloak `issuer`/`subject` for rows that must survive cutover.
3. Drop old unique `(provider, provider_subject)` once backfilled.

### Ordinary Role (config, not a table)

Declared capability set (see `contracts/ordinary-role.md`). Missing declaration → fail closed. **Only** application role in this delivery.

### Trust Material (runtime, not DB)

JWKS from cluster URL; cached keys; refresh on unknown `kid`. No private keys stored.

## Relationships

```text
Keycloak (iss, sub) ──1:1──► user_identities ──N:1──► users ──1:N──► learning data
                                      │
                                      └── sign_in_method = google (this delivery)
```

## State transitions

| Event | Effect |
|-------|--------|
| Operator migration binds `(iss, sub)` → existing `user_id` | Identity row upserted; learning data unchanged |
| First JWT for unknown `(iss, sub)` | Insert `users` + identity (`sign_in_method=google` when applicable); ordinary only |
| JWT verify fail | No DB write; 401/403 |
| Hard cutover | Legacy central-auth / ProcessManager auth credentials rejected; only JWT path |

## Validation rules

- Reject empty `iss` / `sub` after verify.
- Accept only project-audience **access** tokens.
- Do not authorize cross-user private learning data.
- Do not use email uniqueness as platform identity merge during cutover (operator migration owns continuity).
