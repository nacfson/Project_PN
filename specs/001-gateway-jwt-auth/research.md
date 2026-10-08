# Research: Gateway JWT Auth Verification

**Feature**: `001-gateway-jwt-auth`  
**Date**: 2026-10-07

## R1 — JWT verification library (Go)

**Decision**: Use `github.com/lestrrat-go/jwx/v3` (or v2 if toolchain pins) for JWKS fetch + JWT parse/verify (`iss`, `aud`, `exp`/`nbf`, `alg` allowlist, `sub`). Prefer JWKS URL remote key set with in-memory cache and refresh on unknown `kid`.

**Rationale**: First-class JWKS rotation support; explicit algorithm control; fits fail-closed AUTH-04 matrix. Project currently has no JWT dependency (`backend/go.mod`).

**Alternatives considered**:
- `golang-jwt/jwt` + manual JWKS HTTP — workable but more glue for rotation/`kid`.
- Call Keycloak userinfo / token introspect on every request — violates offline-verify intent and adds latency; reject.
- Continue central-auth `/api/auth/session` — contradicts hard cutover.

## R2 — Identity key vs sign-in method

**Decision**: Durable identity = `(issuer, subject)` from verified access JWT. Store `sign_in_method` (`google` only in this delivery; schema allows `apple`/`email` later) as metadata on the identity binding. Unique constraint on `(issuer, subject)`, not on email, not on method alone.

**Rationale**: Spec FR-001/FR-014/FR-014a; enables future Apple/Email without splitting accounts when Keycloak keeps the same `sub`.

**Alternatives considered**:
- Keep `user_identities (provider, provider_subject)` as Google-only unique key — blocks multi-method same subject.
- Key by email — forbidden by platform AUTH-06 / FR-014.

## R3 — Mapping existing `user_identities` schema

**Decision**: Evolve `user_identities` (migration): add `issuer text not null`, rename/repurpose columns so `provider` becomes sign-in method (`google`), `provider_subject` becomes Keycloak `sub` (or add `subject` and migrate). Unique `(issuer, subject)`. Operator migration fills issuer+subject for existing rows before cutover.

**Rationale**: Preserve local `users` and FKs; minimal disruption to learning tables.

**Alternatives considered**:
- New `platform_identities` table + dual write — extra complexity for one cutover.
- Wipe identities and recreate — risks orphaning if operator map incomplete.

## R4 — Replace central-auth session client

**Decision**: Hard cutover in production: remove per-request `CentralClient.ValidateSession` / cookie-session as the auth path. Middleware verifies Bearer JWT locally, then `EnsurePlatformUser(issuer, subject, email?, method)`. Logout/refresh become platform-owned (gateway/Keycloak); PN may expose thin proxies only if product still needs them, otherwise deprecate PN `/api/auth/refresh` against central-auth.

**Rationale**: Spec FR-018; platform AC-05 owns revocation.

**Alternatives considered**:
- Dual-accept JWT + central-auth — rejected (hard cutover).
- Trust `X-User-*` without JWT verify — forbidden.

## R5 — Cookie vs Bearer for web

**Decision**: Treat `Authorization: Bearer <access JWT>` as the sole production credential Project PN verifies. Gateway-injected headers are hints only after JWT success. Do not reintroduce `nacfson_session` cookie validation against central-auth. If Traefik strips/rewrites auth, still require Bearer JWT upstream.

**Rationale**: Aligns with project auth verification guide; simplifies multi-client (all present Bearer).

**Alternatives considered**: Keep cookie internal auth — couples PN to old central-auth cookie protocol.

## R6 — No application-admin role; remove ProcessManager auth remnants

**Decision**: Eliminate application-admin product authorization (`is_admin` / admin bindings / admin-gated APIs). All verified users are ordinary learners with own-data scoping only. Eliminate ProcessManager-as-auth remnants from Project PN code and auth docs. Operational logging packages named `admin` are unrelated to app-admin role unless they grant privileged user powers.

**Rationale**: Explicit product decision — no admin features now; avoid half-migrated auth authorities (ProcessManager / central-auth / Keycloak).

**Alternatives considered**:
- Operator admin bindings (AUTH-06 / AC-12 style) — deferred / out of Project PN product scope this delivery.
- Keep ProcessManager rollback docs — rejected; confuses production auth authority.

## R7 — Auto email link in `EnsureCentralUser`

**Decision**: Stop using same-email auto-link as the **primary** continuity mechanism for cutover. Existing accounts get Keycloak binding via **operator migration**. First-time Keycloak users with no binding create a **new** local user. Optional later: explicit merge flow remains for different emails.

**Rationale**: User decision; reduces surprise account joins during IdP cutover.

**Alternatives considered**: Keep auto email bind on every sign-in — conflicts with operator-migration-first decision.

## R8 — Dev / test identity

**Decision**: Non-production only: either (a) locally signed HS256/RS256 test keys with fixed `iss`/`aud`/`sub`, or (b) retain a clearly gated `AUTH_DEV_BYPASS` that synthesizes a verified identity. Never enable in production config. Tests use generated JWTs against a test JWKS.

**Rationale**: FR-017; replaces `mock-dev-token` central-auth shortcut with JWT-shaped credentials matching production path.

**Alternatives considered**: Keep `mock-dev-token` forever — diverges from verify matrix and hides JWKS bugs.

## R9 — Frontend / clients

**Decision**: Clients stop using central-auth login URLs for production. Web relies on platform gateway (same project host ForwardAuth). Native/desktop/extension obtain project-scoped access JWT from platform (out of PN scope to implement IdP); PN API clients send `Authorization: Bearer`. Update `EXPO_PUBLIC_*` auth base to platform docs; remove assumptions about `token`/`refresh_token` query from central-auth where obsolete.

**Rationale**: FR-006/FR-021/FR-022; Google-only live IdP via Keycloak broker.

**Alternatives considered**: PN-owned OIDC PKCE per client — out of scope / forbidden default.

## R10 — Constitution

**Decision**: Constitution updated to 1.1.x for Keycloak JWT + `(issuer, subject)`; PATCH 1.1.1 removes app-admin provisioning and ProcessManager as auth authority.

**Rationale**: Governance requires constitution to match shipping auth model.

**Alternatives considered**: Ignore constitution — blocked by governance.

## R11 — Provider scope

**Decision**: Live sign-in method this delivery = `google` only. Columns/enums may reserve `apple`/`email` but no PN or platform work in this feature to enable them.

**Rationale**: Explicit user decision for `/speckit-plan`.

## R12 — Ordinary capabilities declaration

**Decision**: Declare ordinary capabilities matching current authenticated learner surface (own learning items, reviews, decks, profile/settings, languages). Fail closed if declaration missing at deploy/runtime config. Document in `contracts/ordinary-role.md` and project manifest alignment.

**Rationale**: FR-009–FR-011 / AUTH-06.
