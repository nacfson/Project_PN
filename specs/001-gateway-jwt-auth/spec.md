# Feature Specification: Gateway JWT Auth Verification & Platform Identity Migration

**Feature Branch**: `001-gateway-jwt-auth`

**Created**: 2026-10-07  
**Updated**: 2026-10-09  

**Status**: Ready for Planning

**Input**: Platform Identity Migration Runbook: Operator cutting Project PN from `central-auth` / ProcessManager-era session auth to the `nacfson_pipeline` platform (Keycloak + Traefik ForwardAuth + Go gateway). Normative references: platform `SPEC.md` AUTH-03–AUTH-06, AC-01–AC-05, AC-12; platform ForwardAuth contract; project contracts `specs/001-gateway-jwt-auth/contracts/` and `backend/docs/platform-identity-migration.md`.

## Clarifications Resolved

| Topic | Decision |
|-------|----------|
| Account database | **Keep** existing Project PN `users` rows and all learning ownership; do not wipe or replace the account database |
| Identity binding | Bind each preserved local user to Keycloak `(issuer, subject)` so the same person keeps the same library |
| Existing-account linking | **Operator migration** — operator runs migration binding local accounts to Keycloak identities before hard cutover; not automatic first-login email linking |
| Sign-in method record | Store which login method was used as an attribute (`sign_in_method`) on the identity binding (`google` live); **not** the permanent unique id |
| Providers in this delivery | **Google only** for live sign-in. Schema/values MAY reserve `apple` / `email` for later; those login paths are out of scope for this feature |
| Verification system | **Entirely** Keycloak / platform project access credentials in production via in-cluster JWKS — no central-auth session validation |
| Dual-accept | **Rejected** — no coexistence of legacy central-auth sessions and JWT in production; hard cutover |
| Clients | **All platforms** (web, native, desktop, extension): same Bearer JWT verify path; platform owns how each client obtains the JWT |
| Credential type | **Access token only** for this project’s audience (`project-pn`); reject ID tokens, Google access tokens, and other non-project credentials |
| Application admin | **Removed** — no app-admin role, bindings, or admin-gated product features in this codebase for this delivery |
| Legacy auth cleanup | **Remove** ProcessManager auth remnants, `auth.nacfson.cloud` client redirects, and legacy central-auth session code/docs from Project PN |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Signed-in learner uses the app with ordinary access (Priority: P1)

A returning learner opens Project PN after authenticating through the platform. The app recognizes them as the same person via their verified `(issuer, subject)` binding and grants ordinary learning capabilities (study, add words, review, manage own decks and settings). There is no application-administrator role.

**Why this priority**: Without reliable identity acceptance and ordinary-role enforcement, no protected learning feature can ship safely on the platform.

**Independent Test**: Present a valid project access credential for a new or known identity; confirm the learner reaches the ordinary experience and cannot access other users’ private data or undeclared operations.

**Acceptance Scenarios**:

1. **Given** a user completed platform Google sign-in for the first time (no prior Project PN account), **When** they open Project PN, **Then** they land on the ordinary experience with only declared ordinary capabilities.
2. **Given** a valid project access credential for an ordinary identity, **When** they call protected learning or profile actions allowed for ordinary users, **Then** those actions succeed for their own data.
3. **Given** a valid project access credential for an ordinary identity, **When** they attempt an undeclared operation, **Then** access is denied.
4. **Given** a valid project access credential for identity A, **When** they request identity B’s private learning data, **Then** access is denied.

---

### User Story 2 - Impersonation, forged identity, and unauthenticated access are rejected fail-closed (Priority: P1)

An unauthenticated visitor, attacker, or misconfigured client tries to access Project PN without a valid project access credential, with an invalid token, or by spoofing identity headers. The project refuses the request and does not run business logic or serve protected application UI.

**Why this priority**: Defense-in-depth is mandatory even though Traefik ForwardAuth gates public ingress; trusting unverified identity or failing open breaks platform security (AUTH-04, AC-03, AC-04).

**Independent Test**: Send protected requests with missing credentials, wrong audience, wrong issuer, bad signature, expired credential, substituted ID-style credential, or spoofed identity headers alone; all must be rejected. On the frontend, verify that connection or auth failures display an unauthenticated state and do not bypass login into the main tabs.

**Acceptance Scenarios**:

1. **Given** no access credential on a protected route, **When** the request is processed, **Then** the project returns 401/403 unauthorized and does not return protected app content.
2. **Given** only client-supplied identity headers (e.g. `X-User-Subject`, `X-User-Issuer`) without a valid Bearer credential, **When** the request is processed, **Then** the project rejects impersonation and strips forged headers.
3. **Given** a credential minted for another project’s audience, **When** it is presented to Project PN, **Then** the project rejects it (`aud != project-pn`).
4. **Given** a credential with wrong issuer (`iss != https://auth.nacfson.cloud/realms/platform`), bad signature, or past expiry, **When** it is presented, **Then** the project rejects it.
5. **Given** an OIDC ID-style credential substituted for a project access credential, **When** it is presented, **Then** the project rejects it.
6. **Given** the frontend client encounters a network error, offline backend, or unauthenticated status, **When** the app initializes, **Then** it strictly transitions to `unauthenticated` (showing login / connection banner) and NEVER defaults to `authenticated`.

---

### User Story 3 - Existing accounts preserve learning progress via operator migration (Priority: P1)

Verification moves entirely to Keycloak project JWTs, while Project PN **preserves** its existing account database and learning history. An operator binds each existing local account to its Keycloak `(issuer, subject)` before cutover so that upon signing in with Google, learners access their existing library (decks, words, FSRS states, review history).

**Why this priority**: Full Keycloak verification without preserving account ownership would silently orphan learner progress.

**Independent Test**: Take a local user that already owns learning data; after operator identity binding and Keycloak sign-in, the same learning data is visible under ordinary access; no duplicate empty account is created for that person.

**Acceptance Scenarios**:

1. **Given** an existing Project PN account with learning data and a completed binding to Keycloak `(issuer, subject)`, **When** that person signs in via the platform and presents a valid project access credential, **Then** they access the **same** local account and see their prior decks/words/reviews.
2. **Given** the account database before cutover, **When** verification switches to Keycloak, **Then** existing `users` rows and owned learning data remain; the migration does not wipe or replace the account database wholesale.
3. **Given** an operator has completed migration binding for an existing local account to a Keycloak `(issuer, subject)`, **When** that person signs in with a valid project access credential, **Then** they reach that same local account without needing an automatic first-login link step.
4. **Given** a Keycloak identity with no prior Project PN account and no operator binding, **When** they sign in for the first time, **Then** a new local account is created with ordinary access only (empty library until they add content).
5. **Given** cutover is complete, **When** a client presents only a legacy central-auth session credential, **Then** Project PN rejects it (hard cutover).
6. **Given** a user signed in via Google (live for this delivery), **When** their binding is stored, **Then** `sign_in_method=google` is recorded and they resolve to one local account keyed by `(issuer, subject)`. Schema MAY later record `apple` / `email` for the same subject without splitting the account; enabling those login paths is out of scope for this delivery.

---

### User Story 4 - Remove app-admin and ProcessManager / legacy auth remnants (Priority: P1)

Project PN has no application-administrator product role. Remove `is_admin`-style app-admin identity, admin bindings, and any admin-gated product APIs/UI. Remove ProcessManager-as-auth remnants, `auth.nacfson.cloud` client redirects, and obsolete central-auth session validation/cookie/refresh client usage from the Project PN codebase and auth docs.

**Why this priority**: Keeps the cutover lean and prevents half-migrated auth (ProcessManager / central-auth / app-admin) from remaining as confusing second paths.

**Independent Test**: Repo search shows no ProcessManager auth path, no `auth.nacfson.cloud` client redirects, and no app-admin authorization path; production auth is JWT verify only; docs do not instruct rolling auth back to ProcessManager.

**Acceptance Scenarios**:

1. **Given** the post-change codebase, **When** a verified learner uses the product, **Then** there is no application-admin capability to grant or exercise.
2. **Given** docs and config for Project PN auth, **When** reviewed, **Then** they describe platform Keycloak JWT only — not ProcessManager auth and not central-auth session validation as production auth.
3. **Given** legacy ProcessManager or central-auth session credentials, **When** presented to Project PN after cutover, **Then** they are rejected.
4. **Given** the frontend client, **When** unauthenticated, **Then** it does not redirect to `auth.nacfson.cloud/login`; platform Traefik ForwardAuth handles browser login redirects.

---

### User Story 5 - All client platforms and operational continuity (Priority: P2)

Web, native, desktop, and extension clients all present the same kind of project access credential. Signing keys rotate and platform sessions end without breaking the verify model. In-cluster JWKS endpoints are used by backend pods under NetworkPolicy. Project PN does not implement per-platform login bypasses.

**Why this priority**: Multi-platform expansion is required; auth must stay “verify only” on every client.

**Independent Test**: Valid project JWT accepted consistently for each in-scope client type in test harnesses; rotation and expiry/reject cases still hold; in-cluster JWKS fetch succeeds under NetworkPolicy.

**Acceptance Scenarios**:

1. **Given** a valid project-scoped Bearer access credential obtained via the platform for web or non-web clients, **When** Project PN verifies it, **Then** the same identity and authorization rules apply regardless of client type.
2. **Given** signing keys rotated and a still-valid project access credential under the new key set, **When** the user continues, **Then** Project PN accepts them after refreshing trust material from the in-cluster JWKS endpoint.
3. **Given** platform logout/revocation completed, **When** the next protected project request arrives, **Then** access fails (platform path); Project PN also independently rejects expired/invalid credentials.

---

### Edge Cases

- Missing, empty, or non-Bearer Authorization on a protected route → reject (401/403); do not execute business logic.
- Spoofed `X-User-Subject` / `X-User-Issuer` without a matching verified credential → reject and discard header hints.
- Credential valid for another project audience (`aud != project-pn`) → reject.
- Credential with foreign issuer (`iss != https://auth.nacfson.cloud/realms/platform`) → reject.
- Tampered signature or disallowed algorithm (including `none`) → reject.
- Expired credential (and not-before when present, within small clock skew) → reject.
- ID-style credential used as API access → reject.
- Unknown signing key id (`kid`) → refresh trust material from JWKS and re-verify; fail closed if still unknown or unreachable.
- In-cluster JWKS unreachable (e.g. NetworkPolicy misconfigured) → fail closed (401/403), no business logic.
- New `(issuer, subject)` with no prior local row → create local account with ordinary access only; no admin from registration.
- Existing local account after Keycloak binding → same row and owned learning data; email remains informational only.
- Unbound existing local account after cutover → must not be reachable via legacy central-auth; operator must complete binding before that learner can sign in under Keycloak (fail closed for unbound legacy login paths).
- Backend connection error / offline server on client startup → frontend fails closed to `unauthenticated` with connection banner; never sets `authenticated`.
- Legacy central-auth Bearer/cookie after hard cutover → reject in production.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Project PN MUST treat platform identity as the verified pair `(issuer, subject)` from a successfully verified project access credential; email and display name MAY be stored as informational attributes only.
- **FR-002**: On every protected request, the project MUST independently verify the inbound Bearer project access credential (presence, signature against current trust material, allowed algorithm, exact issuer, audience for this project, time claims, required subject) and MUST fail closed on any failure.
- **FR-003**: The project MUST NOT trust gateway identity headers alone; after successful credential verification, header mirrors MAY be checked for consistency with verified claims but MUST NOT authorize by themselves.
- **FR-004**: The project MUST accept only Keycloak **access** tokens whose **audience** is this project (`project-pn`). It MUST reject credentials intended for other projects, foreign issuers, bad signatures, expired credentials, disallowed algorithms (including none), missing subject, OIDC **ID tokens**, Google access tokens, and other non-project-access credentials.
- **FR-005**: The project MUST support signing-key rotation by refreshing trust material when an unknown key id appears, then re-verifying; if trust material cannot be obtained, the project MUST fail closed.
- **FR-006**: The project MUST NOT implement browser login, Google OAuth, or identity-broker flows that bypass the platform gateway; those remain platform responsibilities. The frontend MUST NOT redirect to legacy `auth.nacfson.cloud/login`.
- **FR-007**: The project MUST NOT accept Google access tokens or raw OIDC ID tokens as API credentials for Project PN (same rule as FR-004 access-token-only policy).
- **FR-008**: The project MUST NOT mint or trust business-role claims from the gateway. There is **no application-administrator role** in this delivery: do not implement admin bindings, `is_admin` product authorization, or admin-gated learner/product APIs.
- **FR-009**: After first successful sign-in, any verified `(issuer, subject)` MUST receive ordinary access only: landing experience plus explicitly declared ordinary capabilities; undeclared operations MUST be denied.
- **FR-010**: Ordinary capabilities MUST be explicitly declared; missing declaration MUST fail closed (deploy or runtime) — never “allow everything.”
- **FR-011**: Ordinary access MUST NOT grant other users’ private data (default: deny cross-user private data). Automated tests MUST cover identity A denied on identity B’s private learning resources.
- **FR-012**: Project PN MUST remove application-admin features from this codebase: drop or stop using `is_admin` / admin-binding authorization for product access; remove admin-only product endpoints/UI if present; do not add new app-admin surfaces in this feature.
- **FR-013**: Project PN MUST eliminate ProcessManager auth remnants (code, config, and Project PN auth docs that treat ProcessManager as the identity/session authority or instruct rolling auth back to ProcessManager). Production auth documentation MUST describe platform Keycloak JWT verification only.
- **FR-014**: User data and identity bindings MUST be keyed by `(issuer, subject)`, never by email alone as the permanent unique id or sole account-link key.
- **FR-014a**: The project MUST record the sign-in method used for an identity binding using an explicit provider value. For this delivery the live value is `google` only; schema MAY allow `apple` / `email` for later. This value is informational / operational metadata and MUST NOT replace `(issuer, subject)` as the unique identity key.
- **FR-014b**: Apple and Email login paths are **out of scope** for this delivery; only Google-brokered Keycloak sign-in is live.
- **FR-015**: The project MUST ship automated tests covering the accept/reject matrix for credential verification and the ordinary/cross-user authorization matrix described in the acceptance scenarios.
- **FR-016**: Unauthenticated health/probe surfaces (`/healthz`, `/readyz`) MAY remain open only when they expose no user data and are not useful for auth bypass; otherwise they follow the same verification rules.
- **FR-017**: Local development MAY retain a clearly non-production identity bypass for developers (`AUTH_DEV_BYPASS`), but production and hosted platform deployments MUST use verified project access credentials only.
- **FR-018**: Production MUST use a hard cutover: after go-live, Project PN MUST NOT accept legacy central-auth session credentials; only verified Keycloak project access credentials authorize protected requests. Dual-accept is explicitly forbidden.
- **FR-019**: Project PN MUST preserve the existing account database (`users` and owned learning data). Migration MUST NOT wipe or wholesale-replace local accounts as part of switching verification to Keycloak.
- **FR-020**: Before or as part of cutover, each existing local account that should remain reachable MUST be bound to the correct Keycloak `(issuer, subject)` so post-cutover sign-in resolves to that same local account. Binding of existing accounts MUST be performed via **operator migration** (operator-run mapping/process). Automatic first-login linking MUST NOT be required as the primary continuity path for existing accounts.
- **FR-021**: Web, native, desktop, and browser-extension clients MUST all be authorized through the same project JWT verification and `(issuer, subject)` → local account resolution rules; Project PN MUST NOT add a separate project-owned login path per client type.
- **FR-022**: How non-browser clients obtain the project access credential is a platform responsibility; Project PN’s responsibility is verification, account resolution, and authorization only.
- **FR-023**: In hosted deployments, backend JWT verification MUST fetch trust material over the internal cluster network (`http://keycloak-service.identity.svc:8080/realms/platform/protocol/openid-connect/certs`) and NetworkPolicy MUST permit this egress from `proj-pn` to `identity`.
- **FR-024**: On the frontend client, initial authentication verification failures (including network errors, offline backend, or unauthenticated responses) MUST fail closed to an unauthenticated state with a user-facing banner, and MUST NOT grant access to authenticated screens.

---

### Key Entities

- **Platform Identity**: Stable pair `(issuer, subject)` from a verified project access credential; primary key for recognition across sessions.
- **Project Access Credential**: Short-lived, project-audience access token (`aud = project-pn`) forwarded by the platform; the only API credential type Project PN accepts in production after cutover.
- **Ordinary Role**: Explicit set of business capabilities granted to every verified identity (learning, own-data management, ordinary settings). This is the only application role in this delivery.
- **Local User Record**: Existing Project PN account row (`users`) that owns decks and learning progress; preserved across the Keycloak verification migration and linked to `(issuer, subject)`. No application-admin flag is used for authorization.
- **Identity Binding**: Mapping from Keycloak `(issuer, subject)` to a preserved local user record (or to a newly created local user for first-time platform users), stored in `user_identities`, including a `sign_in_method` attribute (`google` / `apple` / `email`).
- **Sign-in Method**: Which brokered login path created or last associated the binding (Google live; Apple/Email deferred). Stored so the product can show “Signed in with …” and support more methods later without changing the identity key.
- **Trust Material**: Public signing keys for the platform issuer, refreshed to support rotation; never private signing keys.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of protected request cases in the verification reject matrix (missing credential, wrong audience, wrong issuer, bad signature, expired, ID-style substitute, spoofed headers only) are denied in automated tests with no business side effects.
- **SC-002**: 100% of valid project-audience **access** tokens with correct issuer, signature, and time claims authorize as ordinary learners in automated tests.
- **SC-003**: First-time platform sign-in yields ordinary access only (no application-admin role exists).
- **SC-004**: Cross-user private data access attempts are denied in 100% of authorization test cases (identity A cannot read identity B’s private learning data).
- **SC-005**: After cleanup, Project PN has no app-admin authorization path and no ProcessManager / `central-auth` auth path in code/docs used for production auth (verified by search + cutover reject tests).
- **SC-006**: After signing-key rotation, previously failing unknown-key cases succeed once trust material is refreshed, without manual redeploy of embedded secrets.
- **SC-007**: Hosted Project PN has no project-owned browser login path that bypasses the platform gateway (manual smoke: unauthenticated protected entry does not serve app content as an authenticated user).
- **SC-008**: After binding and cutover, 100% of sampled existing accounts with learning data remain reachable under Keycloak sign-in on the same local account (same owned decks/words/reviews); account database row counts for preserved users are not wiped by the migration.
- **SC-009**: After hard cutover, legacy central-auth credentials fail closed in 100% of production-path test cases.
- **SC-010**: The same verification and account-resolution rules apply across web and non-web client test cases that present a valid project access credential.

---

## Assumptions

- Platform Traefik ForwardAuth + gateway + Keycloak already perform browser login, Google brokering, SSO cookie, per-project audience issuance (`aud = project-pn`), and session revocation (AC-01–AC-03, AC-05); Project PN still independently verifies every inbound project access credential (AUTH-04).
- The platform provides a way for native, desktop, and extension clients to obtain the same project-scoped access credential shape that browsers receive via the gateway; Project PN does not invent a parallel IdP integration.
- Expected issuer (`https://auth.nacfson.cloud/realms/platform`), project audience (`project-pn`), trust-material location (in-cluster JWKS URL), and allowed algorithms are supplied by deployment configuration, not hard-coded secrets in source.
- Trust material is fetched over the cluster network (`http://keycloak-service.identity.svc:8080/realms/platform/protocol/openid-connect/certs`) under NetworkPolicy in hosted environments.
- Ordinary capabilities for v1 correspond to today’s authenticated learner surface: use own learning data, add/review words, manage own decks/settings/profile. No application-admin product role.
- Operational request logging/metrics packages (historically named `internal/admin`) are not application-admin authorization; they may remain or be renamed later without restoring app-admin powers.
- Account merge across different emails, if retained, continues as an explicit in-app flow and still keys durable identity by `(issuer, subject)` after cutover.
- Binding existing local users to Keycloak identities is done by **operator migration**; the outcome MUST preserve the original account database. Brand-new Keycloak users without a migrated binding still get a new local account on first sign-in.
- Learning schema principles remain unchanged (“a word is global, memory is personal”); this feature changes verification and identity binding, not the vocabulary data model.
- Constitution 1.1.x Identity wording is aligned with gateway JWT; this update removes app-admin provisioning from product scope.
- Local `mock-dev-token`-style bypass remains development-only (`AUTH_DEV_BYPASS`) and must not be enabled in production configuration.
- Platform normative docs (`SPEC.md` AUTH-03–AUTH-06, AC-01–AC-05; gateway ForwardAuth contract; project manifest ordinary-role declaration; identity data model) are authoritative where this spec and older Project PN auth docs conflict. Platform AC-12 admin bindings are **out of product scope** for Project PN this delivery (no app-admin role).
