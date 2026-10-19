# BFF Logout Session Revocation Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Project PN's BFF logout endpoint (`POST /api/auth/logout`), gateway client, frontend session storage, and requirement docs obey the `nacfson_pipeline` session revocation contract: return `200 OK` `{"status":"revoked"}` only after confirmed gateway revocation, and forward `502` or `503` without claiming revocation when Keycloak deletion fails or is unreachable.

**Architecture:** The Project PN backend forwards `Authorization: Bearer v1.<session_handle>` to `POST http://gateway.identity.svc:8080/auth/logout`. Instead of collapsing gateway errors to `401` and answering `204 No Content`, `GatewayClient.LogoutSessionHandle` verifies that the gateway responded `200 OK` with `{"status":"revoked"}` and returns a typed `*GatewayLogoutError` carrying `502` (revocation refused/unconfirmed) or `503` (gateway/Keycloak unreachable). `centralLogout` forwards `502`/`503` unchanged and answers `200 OK` `{"status":"revoked"}` only on confirmed revocation, while the frontend preserves its stored bearer `session_handle` across `502`/`503` failures so a retry can still revoke the session.

**Tech Stack:** Go 1.26 (`net/http`, `github.com/go-chi/chi/v5`), TypeScript 5 (`@project-pn/api`, React Native / Expo `frontend`), Jest.

**Spec:**
- `/home/nacfson/Projects/nacfson_pipeline/contracts/CONTRACT_AUTH_DOOR.md` (§3.4 Online Current-Session Revocation)
- `/home/nacfson/Projects/nacfson_pipeline/specs/001-project-platform/contracts/session-revocation.md` (§1–§3)
- `/home/nacfson/Projects/nacfson_pipeline/specs/009-host-scoped-shared-auth/contracts/gateway-internal-auth-api.md` (§5 Synchronous Session Logout)
- `/home/nacfson/Projects/nacfson_pipeline/specs/009-host-scoped-shared-auth/contracts/shared-verification-module.md` (§1.4 `POST /api/auth/logout`)
- `/home/nacfson/Projects/nacfson_pipeline/specs/002-internal-cluster-vault/contracts/transit-signing.md` (§2)
- `specs/003-bff-session-handle-auth/spec.md` & `specs/003-bff-session-handle-auth/contracts/bff-auth-api.md`

## Global Constraints

- The Project PN caller sends only the current login (`Authorization: Bearer <session_handle>`) to `POST http://gateway.identity.svc:8080/auth/logout`. It MUST NOT send a Keycloak client id, client secret, or session id.
- `POST /api/auth/logout` MUST return `200 OK` with `{"status":"revoked"}` only when the internal gateway reports successful revocation (`200 OK` with JSON `status: "revoked"`).
- `POST /api/auth/logout` MUST forward a gateway `502 Bad Gateway` or `503 Service Unavailable` unchanged, and MUST return `503 Service Unavailable` when the internal gateway is unreachable.
- Neither a `502` nor a `503` response may include `"status":"revoked"`.
- A bearer `session_handle` MUST remain usable in client storage when logout fails with `502` or `503` until a subsequent logout receives confirmed revocation.
- All Go tests MUST run serially (`GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`) and MUST NOT embed static `eyJ...` base64 JWT literals.
- `AddScreen` default `activeTab` MUST remain `'manual'` (do not touch the `AddScreen` cluster).

## Review Focus

- A gateway `200 OK` response with an empty body, malformed JSON, or `{"status":"ok"}` (anything other than `"status":"revoked"`) must not be accepted as a successful revocation; `GatewayClient.LogoutSessionHandle` must reject it as `502 Bad Gateway`. Task 1 tests `200 OK` with non-revoked JSON.
- A gateway `204 No Content` without `{"status":"revoked"}` on `POST /auth/logout` does not satisfy `gateway-internal-auth-api.md` §5 (`200 OK` with `{"status":"revoked","message":"Platform session successfully terminated"}`); `LogoutSessionHandle` must require `200 OK` with `status == "revoked"`. Task 1 pins this.
- When `gateway.identity.svc` is unreachable (transport error) or `gateway == nil` on a `v1.` session handle, `POST /api/auth/logout` must return `503 Service Unavailable`, not `401 Unauthorized` or `500 Internal Server Error`. Task 1 and Task 2 test unreachable gateway and nil gateway handling.
- On `502` or `503` from `POST /api/auth/logout`, `centralLogout` must not emit cookie-clearing `Set-Cookie` headers or `"status":"revoked"` for a bearer `v1.<session_handle>` request, and `frontend/src/api/auth.ts` must not wipe `sessionStorage` in an unconditional `finally` block. Task 2 and Task 3 pin both behaviors.
- Project PN's own spec and handoff docs (`specs/003-bff-session-handle-auth/spec.md`, `specs/003-bff-session-handle-auth/contracts/bff-auth-api.md`, `docs/handoff-spec009-bff-auth.md`, `backend/docs/backend-overview.md`) still require `204 No Content` and `401 Unauthorized` on logout; Task 3 updates them to match the pipeline contracts.

---

### Task 1: Require confirmed `status: "revoked"` and preserve `502`/`503` in `GatewayClient.LogoutSessionHandle`

**Files:**
- Modify: `backend/internal/auth/gateway_client.go:255-280`
- Test: `backend/internal/auth/gateway_client_test.go:262-286`

**Interfaces:**
- Consumes: `ErrInvalidToken` in `backend/internal/auth/errors.go`.
- Produces:
  - `type GatewayLogoutError struct { StatusCode int; Message string; Cause error }` with `func (e *GatewayLogoutError) Error() string` and `func (e *GatewayLogoutError) Unwrap() error` in `backend/internal/auth/gateway_client.go`
  - `func (c *GatewayClient) LogoutSessionHandle(ctx context.Context, sessionHandle string) error` in `backend/internal/auth/gateway_client.go`

- [ ] **Step 1: Write the failing unit tests in `backend/internal/auth/gateway_client_test.go`**

Replace `TestGatewayClient_LogoutSessionHandle` in `backend/internal/auth/gateway_client_test.go` with tests covering `200 OK` (`{"status":"revoked"}`), `502 Bad Gateway`, `503 Service Unavailable`, transport failure (`503`), and `200 OK` without `"status":"revoked"` (`502`):

```go
func TestGatewayClient_LogoutSessionHandle(t *testing.T) {
	t.Run("succeeds only on 200 OK with status revoked", func(t *testing.T) {
		var receivedAuth string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost || r.URL.Path != "/auth/logout" {
				t.Errorf("unexpected method/path: %s %s", r.Method, r.URL.Path)
			}
			receivedAuth = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"revoked","message":"Platform session successfully terminated"}`))
		}))
		defer server.Close()

		client := NewGatewayClient(server.URL+"/auth", SignInShared, server.Client())
		if err := client.LogoutSessionHandle(context.Background(), "v1.handle-to-revoke"); err != nil {
			t.Fatalf("LogoutSessionHandle failed: %v", err)
		}
		if receivedAuth != "Bearer v1.handle-to-revoke" {
			t.Fatalf("expected Bearer v1.handle-to-revoke, got %q", receivedAuth)
		}
	})

	t.Run("rejects non-v1 handle with ErrInvalidToken", func(t *testing.T) {
		client := NewGatewayClient("http://gateway.identity.svc:8080/auth", SignInShared, nil)
		if err := client.LogoutSessionHandle(context.Background(), "invalid-handle"); !errors.Is(err, ErrInvalidToken) {
			t.Fatalf("expected ErrInvalidToken for non-v1 handle, got %v", err)
		}
	})

	t.Run("preserves 502 Bad Gateway when Keycloak refuses delete", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":"revocation_failed","message":"Keycloak did not delete the session"}`))
		}))
		defer server.Close()

		client := NewGatewayClient(server.URL+"/auth", SignInShared, server.Client())
		err := client.LogoutSessionHandle(context.Background(), "v1.handle-502")
		var gwErr *GatewayLogoutError
		if !errors.As(err, &gwErr) || gwErr.StatusCode != http.StatusBadGateway {
			t.Fatalf("expected GatewayLogoutError with 502, got %v", err)
		}
		if gwErr.Message != "Keycloak did not delete the session" {
			t.Fatalf("unexpected message: %q", gwErr.Message)
		}
	})

	t.Run("preserves 503 Service Unavailable when gateway reports Keycloak unreachable", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":"service_unavailable","message":"Keycloak unreachable"}`))
		}))
		defer server.Close()

		client := NewGatewayClient(server.URL+"/auth", SignInShared, server.Client())
		err := client.LogoutSessionHandle(context.Background(), "v1.handle-503")
		var gwErr *GatewayLogoutError
		if !errors.As(err, &gwErr) || gwErr.StatusCode != http.StatusServiceUnavailable {
			t.Fatalf("expected GatewayLogoutError with 503, got %v", err)
		}
	})

	t.Run("returns 503 GatewayLogoutError when gateway is unreachable", func(t *testing.T) {
		client := NewGatewayClient("http://127.0.0.1:54321/auth", SignInShared, &http.Client{Timeout: 50 * time.Millisecond})
		err := client.LogoutSessionHandle(context.Background(), "v1.handle-unreachable")
		var gwErr *GatewayLogoutError
		if !errors.As(err, &gwErr) || gwErr.StatusCode != http.StatusServiceUnavailable {
			t.Fatalf("expected GatewayLogoutError with 503 on transport error, got %v", err)
		}
	})

	t.Run("treats 200 OK without status revoked as 502 Bad Gateway", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		}))
		defer server.Close()

		client := NewGatewayClient(server.URL+"/auth", SignInShared, server.Client())
		err := client.LogoutSessionHandle(context.Background(), "v1.handle-unconfirmed")
		var gwErr *GatewayLogoutError
		if !errors.As(err, &gwErr) || gwErr.StatusCode != http.StatusBadGateway {
			t.Fatalf("expected GatewayLogoutError with 502 when status != revoked, got %v", err)
		}
	})
}
```

Also add `"errors"` to the imports in `backend/internal/auth/gateway_client_test.go`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/auth -run TestGatewayClient_LogoutSessionHandle -v`
Expected: FAIL with `undefined: GatewayLogoutError`.

- [ ] **Step 3: Implement `GatewayLogoutError` and update `LogoutSessionHandle` in `backend/internal/auth/gateway_client.go`**

In `backend/internal/auth/gateway_client.go`:
- Define `GatewayLogoutError` with `StatusCode int`, `Message string`, and `Cause error`, plus `Error() string` and `Unwrap() error`.
- In `LogoutSessionHandle(ctx context.Context, sessionHandle string) error`:
  - Return `ErrInvalidToken` if `!strings.HasPrefix(sessionHandle, "v1.")`.
  - Send `POST` to `c.gatewayURL + "/logout"` with `Authorization: Bearer <sessionHandle>`.
  - On `c.httpClient.Do(req)` error, return `&GatewayLogoutError{StatusCode: http.StatusServiceUnavailable, Message: "authentication gateway unreachable", Cause: err}`.
  - Read up to `4<<10` bytes from `resp.Body` and decode optional `struct { Status string `json:"status"`; Message string `json:"message"` }`.
  - On `http.StatusOK`: return `nil` only when `payload.Status == "revoked"`; otherwise return `&GatewayLogoutError{StatusCode: http.StatusBadGateway, Message: "gateway did not confirm session revocation"}`.
  - On `http.StatusBadGateway`: return `&GatewayLogoutError{StatusCode: http.StatusBadGateway, Message: nonEmpty(payload.Message, "Keycloak did not delete the session")}`.
  - On `http.StatusServiceUnavailable`: return `&GatewayLogoutError{StatusCode: http.StatusServiceUnavailable, Message: nonEmpty(payload.Message, "authentication gateway unavailable")}`.
  - On `http.StatusUnauthorized` or `http.StatusBadRequest`: return `ErrInvalidToken`.
  - On any other status code: return `&GatewayLogoutError{StatusCode: http.StatusBadGateway, Message: nonEmpty(payload.Message, fmt.Sprintf("gateway logout failed with status %d", resp.StatusCode))}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/auth -run TestGatewayClient_LogoutSessionHandle -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/auth/gateway_client.go backend/internal/auth/gateway_client_test.go
git commit -m "feat(auth): require confirmed status revoked and preserve 502/503 in gateway logout"
```

---

### Task 2: Return `200 OK` `{"status":"revoked"}` and forward `502`/`503` in `POST /api/auth/logout`

**Files:**
- Modify: `backend/internal/http/auth_handler.go:354-399`
- Test: `backend/internal/http/auth_handler_test.go:447-460`

**Interfaces:**
- Consumes: `GatewayClient.LogoutSessionHandle` and `*auth.GatewayLogoutError` from Task 1.
- Produces: `POST /api/auth/logout` (`centralLogout` in `backend/internal/http/auth_handler.go`) returning:
  - `200 OK` `{"status":"revoked"}` on confirmed `v1.` revocation
  - `502 Bad Gateway` `{"error":"revocation_failed","message":"..."}` when gateway returns `502` or unconfirmed revocation
  - `503 Service Unavailable` `{"error":"service_unavailable","message":"..."}` when gateway is nil, unreachable, or returns `503`

- [ ] **Step 1: Write the failing HTTP handler tests in `backend/internal/http/auth_handler_test.go`**

In `backend/internal/http/auth_handler_test.go`:
1. Update step 8 of `TestBFFLoginCallbackSessionAndLogoutFlow` (around line 447) to assert `200 OK` and `{"status":"revoked"}` instead of `204 No Content`:

```go
	// 8. POST /api/auth/logout with Bearer v1.<session_handle> revokes handle at gateway and returns 200 {"status":"revoked"}
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.Host = "pn.nacfson.cloud"
	logoutReq.Header.Set("Authorization", "Bearer "+sessResp.Token)
	logoutReq.Header.Set("Origin", "https://pn.nacfson.cloud")
	logoutRec := httptest.NewRecorder()
	router.ServeHTTP(logoutRec, logoutReq)
	if logoutRec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/auth/logout, got %d body=%s", logoutRec.Code, logoutRec.Body.String())
	}
	var logoutBody map[string]string
	if err := json.NewDecoder(logoutRec.Body).Decode(&logoutBody); err != nil {
		t.Fatalf("decode logout response: %v", err)
	}
	if logoutBody["status"] != "revoked" {
		t.Fatalf("expected status=revoked, got %+v", logoutBody)
	}
	if logoutCalledWith != "Bearer v1.sealed-session-handle-777" {
		t.Fatalf("expected gateway logout called with Bearer v1.sealed-session-handle-777, got %q", logoutCalledWith)
	}
```

2. Add `TestBFFLogoutForwards502And503WithoutClaimingRevoked` in `backend/internal/http/auth_handler_test.go`:

```go
func TestBFFLogoutForwards502And503WithoutClaimingRevoked(t *testing.T) {
	for _, tc := range []struct {
		name           string
		gatewayStatus  int
		gatewayPayload string
		wantStatus     int
		wantError      string
	}{
		{
			name:           "forwards 502 when Keycloak refuses delete",
			gatewayStatus:  http.StatusBadGateway,
			gatewayPayload: `{"error":"revocation_failed","message":"Keycloak did not delete the session"}`,
			wantStatus:     http.StatusBadGateway,
			wantError:      "revocation_failed",
		},
		{
			name:           "forwards 503 when Keycloak is unreachable",
			gatewayStatus:  http.StatusServiceUnavailable,
			gatewayPayload: `{"error":"service_unavailable","message":"Keycloak unreachable"}`,
			wantStatus:     http.StatusServiceUnavailable,
			wantError:      "service_unavailable",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mockGateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.gatewayStatus)
				_, _ = w.Write([]byte(tc.gatewayPayload))
			}))
			defer mockGateway.Close()

			gwClient := auth.NewGatewayClient(mockGateway.URL+"/auth", auth.SignInShared, mockGateway.Client())
			logger := &fakeLogger{}
			handler := centralLogout(nil, logger, gwClient)

			req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
			req = req.WithContext(withAuthSession(req.Context(), authSession{
				method:     authMethodBearer,
				credential: "v1.active-session-handle",
			}))
			rec := httptest.NewRecorder()

			handler(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d body=%s", tc.wantStatus, rec.Code, rec.Body.String())
			}
			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode error body: %v", err)
			}
			if body["status"] == "revoked" {
				t.Fatalf("failed logout must never claim status=revoked: %+v", body)
			}
			if body["error"] != tc.wantError {
				t.Fatalf("expected error %q, got %+v", tc.wantError, body)
			}
			if len(rec.Result().Cookies()) != 0 {
				t.Fatalf("expected no cookie clearing on failed bearer logout, got %+v", rec.Result().Cookies())
			}
		})
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && set -a && source .env && set +a && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/http -run "TestBFFLoginCallbackSessionAndLogoutFlow|TestBFFLogoutForwards502And503WithoutClaimingRevoked" -v`
Expected: FAIL (`expected 200 from /api/auth/logout, got 204` and `expected status 502, got 401`).

- [ ] **Step 3: Update `centralLogout` in `backend/internal/http/auth_handler.go`**

In `backend/internal/http/auth_handler.go` (lines 370–398), update the `strings.HasPrefix(session.credential, "v1.")` branch:
- If `gateway == nil`, write `503 Service Unavailable` with `writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "service_unavailable", "message": "gateway auth is not configured"})`.
- If `err := gateway.LogoutSessionHandle(r.Context(), session.credential); err != nil`:
  - Log `AUTH_FAILURE`.
  - Check `var gwErr *auth.GatewayLogoutError; if errors.As(err, &gwErr)`:
    - Set `errCode := "revocation_failed"`; if `gwErr.StatusCode == http.StatusServiceUnavailable`, set `errCode = "service_unavailable"`.
    - Call `writeJSON(w, gwErr.StatusCode, map[string]string{"error": errCode, "message": gwErr.Message})` and return.
  - Otherwise call `writeError(w, http.StatusUnauthorized, "unauthorized")` and return.
- On `err == nil`: clear `auth.CentralSessionCookieName`, call `clearCentralSessionCookie(w, r)`, log `AUTH`, and call `writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})`.

- [ ] **Step 4: Run backend HTTP tests to verify they pass**

Run: `cd backend && set -a && source .env && set +a && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/http -run "TestBFFLoginCallbackSessionAndLogoutFlow|TestBFFLogoutForwards502And503WithoutClaimingRevoked|TestAuthCentralLogout" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/http/auth_handler.go backend/internal/http/auth_handler_test.go
git commit -m "feat(http): return 200 status revoked and forward 502/503 on BFF logout"
```

---

### Task 3: Verify `status: "revoked"` in `@project-pn/api`, preserve bearer handle on `502`/`503` in frontend, and update Project PN logout specs

**Files:**
- Modify: `packages/api/src/auth.ts:23-25`
- Modify: `packages/api/src/client.test.ts`
- Modify: `frontend/src/api/auth.ts:47-54`
- Modify: `specs/003-bff-session-handle-auth/contracts/bff-auth-api.md:84-105`
- Modify: `specs/003-bff-session-handle-auth/spec.md:63-75,100`
- Modify: `docs/handoff-spec009-bff-auth.md:52,130-132`
- Modify: `backend/docs/backend-overview.md:79`

**Interfaces:**
- Consumes: `POST /api/auth/logout` returning `200 OK` `{"status":"revoked"}` or `502`/`503` JSON error from Task 2.
- Produces:
  - `export async function logout(): Promise<void>` in `packages/api/src/auth.ts` (accepts `200 OK` with `{"status":"revoked"}` or legacy `204 No Content`, and throws `ApiError(502, ...)` if a `200 OK` JSON body does not have `status === 'revoked'`).
  - `export async function logout(): Promise<void>` in `frontend/src/api/auth.ts` (clears `sessionStorage` on success or `401`, but preserves the stored bearer `session_handle` when `logoutApi()` throws `502` or `503`).

- [ ] **Step 1: Write the failing API client logout tests in `packages/api/src/client.test.ts`**

Add a `describe('logout', ...)` block in `packages/api/src/client.test.ts` (importing `logout` from `./auth`):

```ts
describe('logout', () => {
  it('resolves when POST /api/auth/logout returns 200 with status revoked', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'revoked' }),
    });
    await expect(logout()).resolves.toBeUndefined();
  });

  it('rejects with 502 ApiError when gateway revocation fails with 502', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: 'revocation_failed', message: 'Keycloak did not delete the session' }),
    });
    await expect(logout()).rejects.toMatchObject({
      status: 502,
      message: 'revocation_failed',
    });
  });

  it('rejects with 502 ApiError if 200 response does not confirm status revoked', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'pending' }),
    });
    await expect(logout()).rejects.toMatchObject({
      status: 502,
    });
  });
});
```

- [ ] **Step 2: Run `@project-pn/api` tests to verify the new test fails**

Run: `npm test -w packages/api`
Expected: FAIL on `rejects with 502 ApiError if 200 response does not confirm status revoked` because `postNoContent` ignores the response body on `200 OK`.

- [ ] **Step 3: Update `packages/api/src/auth.ts` and `frontend/src/api/auth.ts`**

1. In `packages/api/src/auth.ts`, update `logout()`:

```ts
export async function logout(): Promise<void> {
  const res = await postJson<{ status?: string } | null>('/api/auth/logout', undefined);
  if (res !== null && res?.status !== 'revoked') {
    throw new ApiError(502, 'Session revocation was not confirmed by the gateway.');
  }
}
```
(Import `ApiError` from `./client` in `packages/api/src/auth.ts`.)

2. In `frontend/src/api/auth.ts`, update `logout()` so a `502` or `503` revocation failure does not wipe the bearer `session_handle` from `sessionStorage`:

```ts
export async function logout(): Promise<void> {
  try {
    await logoutApi();
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    if (status === 502 || status === 503) {
      throw err;
    }
    clearLanguageOptionsCache();
    await sessionStorage.clearSession();
    throw err;
  }
  clearLanguageOptionsCache();
  await sessionStorage.clearSession();
}
```

- [ ] **Step 4: Update Project PN logout requirement documents**

Update the four Project PN docs so every requirement matches the pipeline contracts:
1. `specs/003-bff-session-handle-auth/contracts/bff-auth-api.md` (§1.5 `POST /api/auth/logout` and §2 table):
   - `200 OK` (`{"status":"revoked"}`): Session handle revoked at gateway (Keycloak `DELETE` returned `204` or `200`).
   - `502 Bad Gateway` (`{"error":"revocation_failed","message":"..."}`): Forwarded when the gateway reports Keycloak refused the session delete or did not confirm `status: revoked`.
   - `503 Service Unavailable` (`{"error":"service_unavailable","message":"..."}`): Forwarded when the gateway reports Keycloak unreachable or when the internal gateway is unreachable.
   - `401 Unauthorized`: Missing or invalid session credential before revocation.
2. `specs/003-bff-session-handle-auth/spec.md` (User Story 4 Acceptance Scenarios 1–2 at lines 72–73, and `FR-009` at line 100):
   - Scenario 1: Completes logout with `200 OK` `{"status":"revoked"}` only when the internal platform gateway confirms revocation.
   - Scenario 2: When the platform gateway returns `502` or `503` (or is unreachable), the backend logs the failure, forwards `502` or `503` without claiming `status: revoked`, and leaves the bearer `session_handle` usable for a subsequent logout retry.
3. `docs/handoff-spec009-bff-auth.md` (§2 table row for `/auth/logout` and §3.2 bullet 3):
   - Document that `POST /api/auth/logout` returns `200 OK` `{"status":"revoked"}` only on confirmed gateway revocation and forwards `502`/`503` unchanged.
4. `backend/docs/backend-overview.md` (line 79):
   - Update `POST /api/auth/logout` description from `Revoke current bearer session. 204.` to `Revoke current session via platform gateway; returns 200 {"status":"revoked"} on confirmed revocation or forwards 502/503 (legacy central-auth returns 204).`

- [ ] **Step 5: Run full verification across backend, `packages/api`, and `frontend`**

Run:
```bash
npm test -w packages/api
npm run typecheck -w packages/api
npm run typecheck -w frontend
npm test -w frontend -- --testPathPattern=AddScreen --watchAll=false
cd backend && set -a && source .env && set +a && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/auth/... ./internal/http/...
```
Expected: All suites and typechecks PASS; `rg "eyJ[A-Za-z0-9_-]{10,}" backend/ frontend/` returns zero matches.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/auth.ts packages/api/src/client.test.ts frontend/src/api/auth.ts specs/003-bff-session-handle-auth/contracts/bff-auth-api.md specs/003-bff-session-handle-auth/spec.md docs/handoff-spec009-bff-auth.md backend/docs/backend-overview.md
git commit -m "feat(auth): verify logout status revoked in client and align BFF logout specs"
```
