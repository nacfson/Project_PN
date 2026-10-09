# Platform Identity Migration Runbook

**Audience**: Operator cutting Project PN from `central-auth` / ProcessManager-era session auth to the `nacfson_pipeline` platform (Keycloak + Traefik ForwardAuth + Go gateway)  
**Feature**: `001-gateway-jwt-auth`  
**Normative contracts**:
- Platform: `nacfson_pipeline/SPEC.md` AUTH-03–AUTH-06, AC-01–AC-05, AC-12
- Platform ForwardAuth: `nacfson_pipeline/specs/001-project-platform/contracts/gateway-forwardauth.md`
- Project: `specs/001-gateway-jwt-auth/contracts/{operator-migration,jwt-verification,auth-api-surface}.md`
- Project auth verification guide: `nacfson_pipeline/docs/project-auth-verification.md`

This runbook is the **operator continuity path** for existing `users` / learning data. It is not automatic first-login email linking.

---

## 0. Cutover decision (locked)

| Topic | Decision |
|-------|----------|
| Continuity | Operator binds each preserved local account to Keycloak `(issuer, subject)` **before** production hard cutover |
| Live IdP | Google only (Keycloak broker); schema may reserve `apple` / `email` |
| Credential | Project-scoped Keycloak **access** JWT only (`aud = project-pn`); reject ID tokens and legacy central-auth sessions |
| App admin | **Removed** — no `is_admin` / admin bindings for product authorization |
| ProcessManager | Must not be treated as Project PN’s auth authority |
| Dual-accept | **Rejected** — no JWT + central-auth coexistence in production |

After cutover, unmigrated legacy accounts remain in Postgres but are unreachable via central-auth credentials until bound or archived.

---

## 1. Architecture map (before → after)

### 1.1 Legacy path (retire)

```text
Browser / native / extension
  → central-auth (nacfson-auth ns, auth-service)
       Google OAuth, nacfson_session cookie, refresh tokens
  → Project PN backend
       ValidateSession / cookie-session / AUTH_SESSION_INTERNAL_TOKEN
       identity = (provider, provider_subject)  # Google-centric
```

Relevant legacy artifacts (do not use as production auth after cutover):

| Artifact | Location |
|----------|----------|
| Central auth service | `Project_PN/central-auth/` |
| Session renewal contract | `backend/docs/central-auth-session-renewal.md` |
| PN session client | `backend/internal/auth/central_client.go` |
| Cookie / refresh proxy | `POST /api/auth/refresh`, internal cookie-session |
| Deploy env (still present until cutover) | `CENTRAL_AUTH_URL`, `CENTRAL_AUTH_INTERNAL_URL`, `AUTH_SESSION_INTERNAL_TOKEN` |

### 1.2 Target path (platform)

```text
Browser
  → https://pn.nacfson.cloud
       Traefik (kube-system / platform ingress)
         middleware strip-forged-headers  (platform ns)
         middleware forward-auth          (platform ns)
           → GET http://gateway.identity.svc:8080/auth
                → Keycloak session / project-scoped access token
         inject Authorization: Bearer <JWT>
              X-User-Subject / X-User-Issuer  (hints only)
  → Service pn-frontend:80  OR  pn-backend:8080  (proj-pn ns)
       backend independently verifies JWT via cluster JWKS
       platform_identity = (iss, sub) → user_identities → users.id
```

Public identity hostname (VPS): `https://auth.nacfson.cloud`  
Cookie domain (gateway env): `.nacfson.cloud`  
Realm issuer (exact): `https://auth.nacfson.cloud/realms/platform`

---

## 2. Kubernetes topology (granular)

All of the following live in **`nacfson_pipeline`**. Project PN does not own cluster identity or ingress middleware.

### 2.1 Namespaces

| Namespace | Owner | Role in this migration |
|-----------|-------|------------------------|
| `flux-system` | Platform | Flux controllers; layer Kustomizations |
| `governance` | Platform | Manual-change policy, operator RBAC, break-glass |
| `vault` | Platform | OpenBao; `vault-db-proxy` for Postgres access |
| `identity` | Platform | Keycloak + Go gateway + platform Postgres StatefulSet |
| `platform` | Platform | Traefik middlewares (`forward-auth`, `strip-forged-headers`), public auth allowlist |
| `proj-pn` | Platform boundary + project workloads | PN frontend/backend; PSA Restricted; NetworkPolicy; ResourceQuota |

Project namespace labels (boundary):

- `platform.nacfson.io/project-id: pn`
- `pod-security.kubernetes.io/enforce: restricted` (enforce, not warn-only)
- Flux prune disabled on the Namespace object

### 2.2 Flux reconciliation layers (`clusters/vps-k3s/layers.yaml`)

Order matters. Auth cutover assumes these layers are healthy before flipping PN env:

```text
governance
  → vault
    → vault-proxies
    → database          # postgres in identity ns
      → identity        # Keycloak + gateway (COOKIE_DOMAIN / KEYCLOAK_PUBLIC_URL patched)
        → ingress       # public-auth-allowlist Host(auth.nacfson.cloud) …
governance
  → project-boundaries  # proj-pn Namespace, SA, NetworkPolicy, Quota, reconciler RBAC
    → projects          # clusters/vps-k3s/projects → proj-pn Kustomization
         → workloads    # IngressRoute + Deployments (pn-reconciler SA)
```

Project workload Kustomization (`clusters/vps-k3s/projects/proj-pn.yaml`):

- `serviceAccountName: pn-reconciler` (cannot mutate Namespace / NetworkPolicy / ResourceQuota / SA)
- `dependsOn`: `project-boundaries`, `ingress`, `vault-proxies`
- Host patches: `Host(\`pn.nacfson.cloud\`)` and `/api` → backend
- Today still patches `CENTRAL_AUTH_URL` — **replace with `AUTH_JWT_*` at cutover** (see §5)

### 2.3 Identity plane objects

| Object | Namespace | Purpose |
|--------|-----------|---------|
| Deployment `keycloak` + Service `keycloak-service:8080` | `identity` | Realm `platform`; Google broker; JWT signing |
| ConfigMap `keycloak-realm-config` | `identity` | Clients `gateway-client`, `project-pn`, `session-revocation-client`; scope `project-pn-audience` |
| Deployment `gateway` + Service `gateway:8080` | `identity` | OIDC + ForwardAuth `/auth`; secrets from Vault init container |
| IngressRoute `public-auth-allowlist` | `platform` | Only allowlisted Keycloak login/broker + gateway callback + logout on `auth.nacfson.cloud` |

Keycloak client facts for Project PN:

| Field | Value |
|-------|-------|
| Client id / JWT `aud` | `project-pn` |
| Audience mapper scope | `project-pn-audience` → `included.client.audience: project-pn` on access token |
| Redirect URIs (realm template) | `https://pn.nacfson.cloud/*`, localhost/dev variants |
| Gateway client | `gateway-client` (confidential; also carries `project-pn-audience`) |

### 2.4 Ingress trust chain for `pn.nacfson.cloud`

From `deploy/projects/pn/workloads/ingress-route.yaml` + platform middleware:

1. **IngressRoute** `project-pn-ingress` in `proj-pn`
   - Host `pn.nacfson.cloud` → `pn-frontend:80`
   - Host `pn.nacfson.cloud` + `PathPrefix(/api)` → `pn-backend:8080`
2. Middlewares (both routes), cross-namespace:
   - `strip-forged-headers.platform` — clears inbound `X-User-Subject` / `X-User-Issuer`
   - `forward-auth.platform` — calls `http://gateway.identity.svc:8080/auth`
3. On ForwardAuth **200**, Traefik copies response headers upstream:
   - `Authorization: Bearer <project access JWT>`
   - `X-User-Subject`, `X-User-Issuer`
4. PN backend **must** re-verify the Bearer JWT (AUTH-04). Headers alone never authorize.

Unauthenticated browser → gateway **302** to Keycloak Google broker (platform-owned). PN must not reimplement `/login` against `central-auth`.

### 2.5 Workload boundary (`deploy/projects/pn/boundary/`)

| Manifest | Constraint |
|----------|------------|
| `namespace.yaml` | PSA Restricted enforce + warn + audit |
| `service-account.yaml` | `pn-workload-sa`; `automountServiceAccountToken: false` |
| `resource-quota.yaml` | CPU/mem hard 550m / 1024Mi; `services.nodeports: 0`; `services.loadbalancers: 0` |
| `network-policy.yaml` | Default deny; see §2.6 |
| `reconciler-rbac.yaml` | Project reconciler cannot weaken isolation |

Backend Deployment facts (`workloads/backend-deployment.yaml`):

| Setting | Value |
|---------|-------|
| Namespace / SA | `proj-pn` / `pn-workload-sa` |
| Port / probes | `8080`; `/healthz` liveness + readiness (unauthenticated, no user data) |
| DB path | `vault-db-proxy.vault.svc:5432` DB `proj_pn` (no direct Postgres) |
| Security | non-root `10001`, read-only root FS, drop ALL caps, no automounted SA token |
| Resources | request=limit `300m` / `512Mi` |

### 2.6 NetworkPolicy — required change for JWT verification

Current `project-pn-isolation` egress allowlist:

| Egress | Port | Status |
|--------|------|--------|
| `kube-system` CoreDNS | 53 TCP/UDP | Required |
| `vault` / `vault-db-proxy` | 5432 | Required (Zero-Plaintext DB) |
| `identity` / Keycloak JWKS | 8080 | **Missing today — must add before JWT mode** |
| Arbitrary internet | — | Denied by default |

Add an egress rule so `pn-backend` can fetch JWKS over the **cluster network** (never the public ingress for verification):

```yaml
# Intended addition to deploy/projects/pn/boundary/network-policy.yaml
- to:
    - namespaceSelector:
        matchLabels:
          name: identity   # or kubernetes.io/metadata.name: identity — match cluster labels
      podSelector:
        matchLabels:
          app.kubernetes.io/name: keycloak
  ports:
    - protocol: TCP
      port: 8080
```

Canonical JWKS URL shape:

```text
http://keycloak-service.identity.svc:8080/realms/platform/protocol/openid-connect/certs
```

Fail closed if JWKS is unreachable (AUTH-04 / AC-04). Do **not** point production verify at `https://auth.nacfson.cloud/...` from the pod if NetworkPolicy or public allowlisting would make that fragile; prefer in-cluster Service DNS.

Ingress remains: Traefik (`platform`) → ports 80/8080; intra-namespace frontend→backend 8080.

### 2.7 Secrets and config ownership

| Concern | Where it lives | Notes |
|---------|----------------|-------|
| Gateway HMAC / client / revocation secrets | Vault KV → gateway emptyDir via init | Not in Project PN repo |
| Keycloak Google broker secret | Vault / Keycloak broker contract | Platform-owned |
| `project-pn` client secret | Realm template `${PROJECT_PN_CLIENT_SECRET}` | Platform; PN does not need it for JWT **verify** |
| PN `AUTH_JWT_*` | Backend Deployment env + Cursor secrets docs | Public issuer/audience/JWKS — not private signing keys |
| DB credentials | Vault DB proxy role `project:pn:workload:backend` | Unchanged by auth cutover |
| Image pull | Namespace Secret (GHCR read) | Unchanged |

GitOps invariant: Flux must not prune externally supplied Secret contents. Manual kubectl edits in managed namespaces are rejected by ValidatingAdmissionPolicy — deliver NetworkPolicy / env changes via PR to `nacfson_pipeline`.

---

## 3. Identity data model cutover

### 3.1 Preserve

- `users` and all learning tables (`user_word_senses`, `review_states`, `review_attempts`, decks, …)
- Row counts for continuity accounts

### 3.2 Evolve `user_identities`

| Column | Rule |
|--------|------|
| `issuer` | Exact `https://auth.nacfson.cloud/realms/platform` (or env-specific issuer) |
| `subject` | Keycloak `sub` |
| `sign_in_method` | `google` for this delivery |
| Unique key | `(issuer, subject)` — **not** email |

Schema migration artifact (feature tasks): `backend/db/migrations/*_platform_identity_bindings.{up,down}.sql`.

Ignore / stop using `is_admin` for product authorization.

### 3.3 Runtime resolution after cutover

```text
Verified JWT (iss, sub)
  → lookup user_identities
      hit  → users.id (same library)
      miss → create ordinary users row + identity binding (new library)
```

Email may appear in JWT claims for display; it is **not** the merge key during cutover.

---

## 4. Operator binding procedure

### 4.1 Inputs (operator-collected)

For each account that must keep its library:

| Input | Source |
|-------|--------|
| Local `users.id` | PN DB (`SELECT id, email FROM users …`) — email is lookup convenience only |
| Keycloak `issuer` | Exact realm issuer URL used in tokens |
| Keycloak `subject` | Keycloak Admin / user federation / first successful Google login in a **staging** realm, recorded before prod flip |
| `sign_in_method` | `google` |

Do **not** commit live tokens, Keycloak admin passwords, or full JWT dumps into git.

### 4.2 Binding SQL template

Script target (feature tasks): `scripts/migrate-platform-identities.sql` (or `.sh` wrapper).

Illustrative upsert (adjust column names to the evolved schema):

```sql
-- Bind Keycloak identity to an existing Project PN user.
-- Replace :user_id, :issuer, :subject before execution.

BEGIN;

INSERT INTO user_identities (
  user_id,
  issuer,
  subject,
  sign_in_method,
  email_at_provider,
  created_at,
  updated_at
) VALUES (
  :user_id,
  :issuer,
  :subject,
  'google',
  NULL,  -- optional informational snapshot
  NOW(),
  NOW()
)
ON CONFLICT (issuer, subject) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  sign_in_method = EXCLUDED.sign_in_method,
  updated_at = NOW();

-- Sanity: learning rows still owned by the same user
-- SELECT COUNT(*) FROM user_word_senses WHERE user_id = :user_id;

COMMIT;
```

Constraints:

1. Operator-run is the **primary** continuity path.  
2. Do not truncate `users` or learning tables.  
3. Do not grant app-admin.  
4. Unmigrated users stay in DB but cannot authenticate with legacy credentials after hard cutover.

### 4.3 How to obtain `(issuer, subject)` safely

Preferred staging sequence:

1. Ensure Keycloak realm `platform` and client `project-pn` exist (Flux `identity` layer green).  
2. Sign in once via gateway on a non-prod host (or inspect Keycloak user after Google broker).  
3. Record `iss` from a sample access token and `sub` from Keycloak user id.  
4. Map to the matching `users.id` offline (email as human aid).  
5. Apply SQL against `proj_pn` through the approved DB access path (vault-db-proxy / break-glass), not by exposing Postgres NodePort.

### 4.4 Acceptance for a sample migrated user

| Check | Pass |
|-------|------|
| Valid project JWT for bound `(iss, sub)` | Same `users.id`; prior decks/words/reviews visible |
| `users` / learning row counts | Not wiped |
| Legacy central-auth / `mock-dev-token` with production config | Rejected |
| New Keycloak user with no binding | New ordinary local user only |

---

## 5. Cluster / app hard cutover checklist

Execute in order. Prefer PRs in **both** repos when ownership splits.

### Phase A — Platform prerequisites (`nacfson_pipeline`)

- [ ] `identity` Flux Kustomization Ready; Keycloak + gateway pods healthy  
- [ ] Realm contains client `project-pn` and scope `project-pn-audience`  
- [ ] IngressRoute for `pn.nacfson.cloud` uses `strip-forged-headers` + `forward-auth`  
- [ ] Public allowlist on `auth.nacfson.cloud` limited to login/broker/callback/logout (AUTH-03 allowlist)  
- [ ] **NetworkPolicy egress** from `proj-pn` → Keycloak JWKS (§2.6) merged and reconciled  
- [ ] Gateway env on VPS: `COOKIE_DOMAIN=.nacfson.cloud`, `KEYCLOAK_PUBLIC_URL=https://auth.nacfson.cloud/realms/platform`

### Phase B — Project PN code + schema (`Project_PN`)

- [ ] Schema migration for `(issuer, subject, sign_in_method)` applied to `proj_pn`  
- [ ] JWT middleware wired; production requires `AUTH_JWT_*` (fail closed if missing)  
- [ ] Operator bindings applied for all continuity accounts (§4)  
- [ ] Production path rejects central-auth session validate / refresh / cookie-session  
- [ ] `POST /api/auth/refresh` deprecated (410) or removed (auth-api-surface)  
- [ ] Clients send `Authorization: Bearer <project_access_jwt>` only  
- [ ] Frontend stops using `central-auth` `/login` as production IdP  
- [ ] App-admin product authz removed; ordinary + own-data only  
- [ ] Automated JWT accept/reject matrix green (`go test` auth packages)

### Phase C — Deployment env flip

Replace legacy env on `pn-backend` (base + `clusters/*/projects/proj-pn.yaml` patches):

| Remove / stop depending on | Add / require |
|----------------------------|---------------|
| `CENTRAL_AUTH_URL` | `AUTH_JWT_ISSUER=https://auth.nacfson.cloud/realms/platform` |
| `CENTRAL_AUTH_INTERNAL_URL` | `AUTH_JWT_AUDIENCE=project-pn` |
| `AUTH_SESSION_INTERNAL_TOKEN` | `AUTH_JWT_JWKS_URL=http://keycloak-service.identity.svc:8080/realms/platform/protocol/openid-connect/certs` |
| Production `mock-dev-token` | Alg allowlist (e.g. `RS256`); optional skew; `AUTH_DEV_BYPASS` **off** in prod |

Document names in `backend/docs/cursor-secrets.md` and `backend/.env.example`.

### Phase D — Retire central-auth dependency

- [ ] PN Deployments no longer reference `nacfson-auth` / `auth-service`  
- [ ] Ops decision (separate): retire `central-auth/` deploy for PN consumers  
- [ ] Update `oracle-deploy-runbook.md`, `deploy-exception-runbook.md`, `AGENTS.md` so auth failures point at JWT/JWKS/issuer/audience, not ProcessManager

---

## 6. Verification matrix (operator + agent)

### 6.1 Automated (PN repo)

```sh
cd backend && set -a && source .env && set +a
GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/auth/ ./internal/http/ -count=1
```

Must cover: valid token; wrong `aud`/`iss`; bad sig; expired; ID token; missing Bearer / spoofed `X-User-*`; JWKS rotation / unreachable fail-closed; cross-user denial.

### 6.2 In-cluster smoke (when env available)

Use read-only kubectl via SSH tunnel + `governance/operator-readonly` where possible; break-glass only for probes that mutate.

| Scenario | Expect |
|----------|--------|
| AC-01 First Google sign-in via gateway | Ordinary landing; no admin; no other users’ data |
| AC-03 Unauthenticated `/api/...` | Not 200 with private content; forged headers ignored |
| AC-04 JWT matrix | As automated; JWKS from in-cluster URL |
| AC-05 Logout / session revoke on gateway | Next PN request fails even if old JWT not yet expired (platform); PN still rejects expired/invalid JWT |
| Continuity | Migrated user sees prior learning counts |
| Hard cutover | Legacy central-auth credential rejected |

Record pass/fail + commands in operator notes. **Do not** commit live tokens.

### 6.3 Probe safety

`/healthz` and `/readyz` stay unauthenticated **only** if they expose no user data. Prefer cluster-internal probe paths consistent with IngressRoute (probes hit the pod directly; Traefik ForwardAuth does not apply to kubelet probes).

---

## 7. Failure modes & rollback posture

| Failure | Symptom | Action |
|---------|---------|--------|
| NetworkPolicy missing JWKS egress | All protected APIs 401/403; JWKS fetch errors in logs | Merge §2.6 egress; wait for Flux `project-boundaries` |
| Wrong `AUTH_JWT_AUDIENCE` | Valid gateway tokens rejected | Must be `project-pn` matching realm client |
| Wrong issuer string | Exact-match failure | Use public realm issuer URL, not in-cluster HTTP host, for `iss` claim |
| Dual stack left enabled | Ambiguous auth / security hole | Hard cutover only — remove central-auth client from production binary path |
| Operator binding missed | User gets **new** empty library | Bind `(iss, sub)` to correct `users.id`; do not wipe DB |
| Need rollback to central-auth | Only if JWT binary not yet promoted | Revert Deployment image/env via Git; treat as emergency — prefer fix-forward on JWT path once cut over |

Rollback after hard cutover reintroduces a retired IdP; plan continuity bindings **before** flipping env.

---

## 8. Document & ownership split

| Change | Repo |
|--------|------|
| Traefik middleware, Keycloak realm, gateway, NetworkPolicy JWKS egress, Flux host/env patches | `nacfson_pipeline` |
| JWT verifier, schema migration, operator SQL, client Bearer, doc/agent updates | `Project_PN` |
| Auth product behavior | Platform owns login/SSO/revoke; PN owns verify + ordinary authorization + account binding |

Related Project PN docs to keep consistent after cutover:

- `specs/001-gateway-jwt-auth/*`
- `backend/docs/backend-overview.md`, `backend-flows.md`
- `backend/docs/cursor-secrets.md`
- Retire conflicting instructions in `central-auth-session-renewal.md` for production PN (historical reference only)

---

## 9. Completion criteria

Mark migration **done** only when all are true:

- [ ] Continuity accounts bound `(issuer, subject)` → existing `users.id` with `sign_in_method=google`  
- [ ] Production verifies Keycloak project access JWT only (JWKS, iss, aud, alg, exp, sub)  
- [ ] In-cluster JWKS reachable under NetworkPolicy; fail closed otherwise  
- [ ] ForwardAuth middlewares on `pn.nacfson.cloud`; PN does not host production Google login  
- [ ] Legacy central-auth / ProcessManager / `mock-dev-token` production paths rejected  
- [ ] Learning data preserved; no app-admin product role  
- [ ] AC-01 / AC-03 / AC-04 / AC-05 / continuity checks recorded without committing secrets  
