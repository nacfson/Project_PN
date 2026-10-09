# Contract: Operator Migration (Existing Accounts)

**Normative refs**: Spec clarifications — preserve account DB; operator migration; Google-only live

## Goal

Before production hard cutover, bind each **existing** local `users` row that must remain reachable to its Keycloak `(issuer, subject)` so post-cutover Google sign-in opens the **same** library.

## Inputs (operator-provided)

| Input | Purpose |
|-------|---------|
| Local `users.id` (or stable email lookup for operator convenience) | Target Project PN account |
| Keycloak `issuer` | Exact realm issuer |
| Keycloak `subject` | User `sub` in that realm |
| `sign_in_method` | `google` for this delivery |

Email may help the operator find the row; it is **not** the stored unique platform key.

## Outputs

- Upsert `user_identities` (or evolved table) with `UNIQUE (issuer, subject)` → `user_id`  
- No wipe of `users` or learning tables  
- No automatic grant of admin

## Process constraints

1. Operator runs migration (script/SQL/runbook) — **primary** continuity path.  
2. Automatic first-login email link is **not** the primary cutover mechanism.  
3. Unmigrated legacy accounts are unreachable via central-auth after cutover; they remain in DB until bound or archived.  
4. New Keycloak users without a binding get a **new** local user on first JWT (ordinary only).  
5. Do not commit live tokens or Keycloak admin passwords into git.

## Acceptance

| Check | Pass |
|-------|------|
| Sample migrated user signs in with valid project JWT | Sees prior decks/words/reviews |
| Row counts for preserved `users` | Not wiped by migration |
| Admin flag | Unchanged unless operator explicitly sets |
| Legacy central-auth credential after cutover | Rejected |

## Operator runbook

Full Kubernetes topology, Flux layers, NetworkPolicy JWKS egress, env flip, and cutover checklist:

[`backend/docs/platform-identity-migration.md`](../../../backend/docs/platform-identity-migration.md)
