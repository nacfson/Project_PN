# Contract: Inbound JWT Verification

**Audience**: Project PN API (defense in depth behind platform ForwardAuth)  
**Normative refs**: Platform AUTH-04 / AC-04; feature spec FR-002–FR-005

## Request inputs

| Input | Required | Trust |
|-------|----------|--------|
| `Authorization: Bearer <access_jwt>` | Yes for protected routes | Verify fully |
| `X-User-Subject` | Optional hint | Must match JWT `sub` if both present; never authorize alone |
| `X-User-Issuer` | Optional hint | Must match JWT `iss` if both present; never authorize alone |

Strip/ignore client-spoofed identity headers until after successful JWT verification.

## Configuration (deployment)

| Name | Meaning |
|------|---------|
| Expected `iss` | Exact realm issuer URL |
| Expected `aud` | This project’s Keycloak client id (e.g. `project-pn`) |
| JWKS URL | Cluster-internal realm certs URL |
| Allowed `alg` | Explicit allowlist (typically `RS256`); reject `none` and others |

## Verification steps (all required)

1. Bearer present and non-empty  
2. Signature via JWKS (refresh on unknown `kid`)  
3. `alg` ∈ allowlist  
4. `iss` equals configured issuer  
5. `aud` contains/equals project client id  
6. `exp` (and `nbf` if present) with small skew  
7. `sub` present  
8. Credential is a Keycloak **access** token for **this** project audience only — reject OIDC **ID tokens**, Google access tokens, and tokens whose `aud` is not this project  

**Fail closed**: any failure → 401/403; no business handler execution.

**Locked product decision**: access token + project audience only (implementers use Keycloak access-token markers / `aud` = project client id).

## Success output (internal)

```text
platform_identity = { issuer, subject }
optional: email (informational), sign_in_method = google (this delivery)
```

## Automated test matrix

| Case | Expected |
|------|----------|
| Valid project access token | Accept |
| Wrong `aud` | Reject |
| Wrong `iss` | Reject |
| Bad signature | Reject |
| Expired | Reject |
| ID token substituted | Reject |
| Missing Bearer / spoofed headers only | Reject |
| New JWKS `kid` after rotation | Accept after JWKS refresh |
