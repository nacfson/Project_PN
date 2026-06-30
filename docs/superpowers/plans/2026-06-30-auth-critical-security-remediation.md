# Auth Critical Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the critical authentication vulnerabilities in Project PN and ProcessManager, prioritizing remote-exploitable bypasses and hardcoded secrets.

**Architecture:** Harden trust boundaries by rejecting attacker-controllable headers and redirects, removing default credentials, forcing auth initialization, and adding rate limiting. Changes are localized to middleware, handlers, config loading, and deployment manifests.

**Tech Stack:** Go 1.22+, Chi/httprate, PostgreSQL, React Native/Expo, Kubernetes manifests, nginx.

## Global Constraints

- Do not introduce new external dependencies unless required.
- Keep changes minimal and focused on security; no unrelated refactoring.
- All Go code must compile and existing tests must pass.
- Project PN backend remains local-PostgreSQL-first; central auth mode is fixed, not removed.
- ProcessManager manifests stay compatible with the existing `nacfson-*` namespaces.

---

## Task 1: Project PN — Remove Central Auth Proxy-Header Fallback

**Files:**
- Modify: `backend/internal/http/auth_middleware.go:89-134`
- Modify: `backend/internal/http/router.go:30` (rate-limit IP key source)
- Create: `backend/internal/http/auth_middleware_test.go`

**Interfaces:**
- Consumes: `auth.CentralClient.ValidateSession`, `auth.Service.EnsureCentralUser`
- Produces: `centralAuthMiddleware` no longer calls `centralUserFromProxyHeaders`; `bearerToken` unchanged.

### Why
`AUTH_MODE=central` currently falls back to trusting `X-User-Id` / `X-User-Email` headers when no bearer token is present. nginx forwards those headers from the inbound client, so any HTTP client can impersonate any user.

### Steps

- [ ] **Step 1: Write the failing test**

Create `backend/internal/http/auth_middleware_test.go`:

```go
package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"project-pn/internal/auth"
)

type fakeCentral struct{}

func (f *fakeCentral) ValidateSession(ctx context.Context, token string) (*auth.CentralSession, error) {
	return nil, errors.New("invalid token")
}

func TestCentralAuthMiddleware_RejectsProxyHeaders(t *testing.T) {
	svc := &auth.Service{}
	central := &fakeCentral{}
	mw := centralAuthMiddleware(svc, central)

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("X-User-Id", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("X-User-Email", "attacker@example.com")
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}
```

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/backend
go test ./internal/http/... -run TestCentralAuthMiddleware_RejectsProxyHeaders -v
```

Expected: FAIL (current code returns 200).

- [ ] **Step 2: Remove the proxy-header fallback**

Modify `backend/internal/http/auth_middleware.go`:

```go
func centralAuthMiddleware(svc *auth.Service, central *auth.CentralClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r)
			if token == "" {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if central == nil {
				writeError(w, http.StatusInternalServerError, "central auth is not configured")
				return
			}
			session, err := central.ValidateSession(r.Context(), token)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			user, err := svc.EnsureCentralUser(r.Context(), session.User)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			next.ServeHTTP(w, r.WithContext(withUser(r.Context(), user)))
		})
	}
}
```

Delete `centralUserFromProxyHeaders` and `hasProxyRole` functions entirely (lines 123-143).

- [ ] **Step 3: Update nginx to stop forwarding client X-User-* headers**

Modify `deploy/nginx/nginx.conf`:

In both `location ~ ^/api/auth/ { ... }` and `location /api/ { ... }`, remove:

```nginx
proxy_set_header X-User-Id $http_x_user_id;
proxy_set_header X-User-Email $http_x_user_email;
proxy_set_header X-User-Roles $http_x_user_roles;
```

These headers must only be set by a trusted upstream. With this fix they are not forwarded at all; if internal service-to-service calls ever need them, they must be injected by a mutually-authenticated gateway, not nginx.

- [ ] **Step 4: Fix rate-limit IP key to use nginx-provided real IP**

Modify `backend/internal/http/router.go` around line 30:

```go
// Replace httprate.KeyByIP with a key function that reads X-Real-IP set by nginx.
func keyByRealIP(r *http.Request) (string, error) {
	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.RemoteAddr
	}
	return ip, nil
}
```

Update `authIPRateLimit` in `backend/internal/http/auth_middleware.go`:

```go
func authIPRateLimit() func(http.Handler) http.Handler {
	return httprate.Limit(
		authRateLimit,
		time.Minute,
		httprate.WithKeyFuncs(keyByRealIP),
		httprate.WithLimitHandler(rateLimitResponse),
	)
}
```

Do the same for `consumeIPRateLimit`.

- [ ] **Step 5: Run tests**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/backend
go test ./internal/http/... -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add backend/internal/http/auth_middleware.go backend/internal/http/auth_middleware_test.go backend/internal/http/router.go deploy/nginx/nginx.conf
git commit -m "fix(auth): remove central auth proxy-header fallback and harden rate-limit IP key"
```

---

## Task 2: Project PN — Remove Hardcoded Database Password Fallback

**Files:**
- Modify: `backend/internal/config/config.go:11`, `:80`
- Modify: `backend/compose.yaml:9`
- Create: `backend/internal/config/config_test.go`

**Interfaces:**
- Consumes: `DATABASE_URL` env var.
- Produces: `Config.DatabaseURL` is empty when env var is unset; startup code checks it.

### Why
`config.go` falls back to `postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable` when `DATABASE_URL` is missing. A deployed binary/container missing the env var connects with a published password.

### Steps

- [ ] **Step 1: Write the failing test**

Create `backend/internal/config/config_test.go`:

```go
package config

import (
	"os"
	"testing"
)

func TestLoad_DatabaseURLNoDefault(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	cfg := Load()
	if cfg.DatabaseURL != "" {
		t.Fatalf("expected empty DatabaseURL when env unset, got %q", cfg.DatabaseURL)
	}
}
```

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/backend
go test ./internal/config/... -run TestLoad_DatabaseURLNoDefault -v
```

Expected: FAIL.

- [ ] **Step 2: Remove the default and fail startup when unset**

Modify `backend/internal/config/config.go`:

```go
const (
	defaultAppAddr        = ":8080"
	defaultMigrationsPath = "file://db/migrations"
	// defaultDatabaseURL removed — no hardcoded credentials.
	...
)
```

Change `Load()`:

```go
DatabaseURL: os.Getenv("DATABASE_URL"),
```

Modify `backend/cmd/server/main.go` (or wherever the DB pool is created) to fail fast:

```go
func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	...
}
```

If the server startup code is in a different file, locate it with `grep -r "config.Load" backend/cmd` and add the check there.

- [ ] **Step 3: Remove hardcoded password from compose**

Modify `backend/compose.yaml`:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-project_pn}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-project_pn_dev}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/backend
go test ./internal/config/... -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add backend/internal/config/config.go backend/internal/config/config_test.go backend/compose.yaml backend/cmd/server/main.go
git commit -m "fix(config): remove hardcoded database password fallback and require DATABASE_URL"
```

---

## Task 3: Project PN — Guard Dev Guest Seed Backdoor

**Files:**
- Modify: `scripts/seed-dev-guest.sql:1-6`
- Modify: `scripts/seed-dev-guest.sh`
- Modify: `scripts/start-web-dev.sh`

**Interfaces:**
- Consumes: `APP_ENV` or `PN_ENV` env var.
- Produces: Seed script refuses to run unless environment is explicitly local/dev.

### Why
`scripts/seed-dev-guest.sql` creates a long-lived session with the plaintext token `local-dev-guest`. It must never run in production.

### Steps

- [ ] **Step 1: Add environment guard to the SQL seed**

Modify `scripts/seed-dev-guest.sql` at the top:

```sql
-- Local dev-only guest seed.
-- This file is intentionally NOT a migration; it is applied by scripts/start-web-dev.sh
-- and scripts/seed-dev-guest.sh only. It must never run in production or staging.

\set env_var `echo "$PN_ENV"`
\if :env_var != 'local'
  \echo 'FATAL: seed-dev-guest.sql can only run with PN_ENV=local'
  \quit
\endif

-- Plain token: local-dev-guest
...
```

If `psql` does not support the `\if` syntax used here, switch to a shell guard instead (see Step 2).

- [ ] **Step 2: Add environment guard to the shell scripts**

Modify `scripts/seed-dev-guest.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ "${PN_ENV:-}" != "local" && "${APP_ENV:-}" != "local" ]]; then
  echo "FATAL: seed-dev-guest.sh can only run with PN_ENV=local or APP_ENV=local" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${SCRIPT_DIR}/seed-dev-guest.sql"
```

Modify `scripts/start-web-dev.sh` to export `PN_ENV=local` before invoking the seed:

```bash
export PN_ENV=local
# ... later ...
./scripts/seed-dev-guest.sh
```

- [ ] **Step 3: Verify the guard fails outside local**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
unset PN_ENV APP_ENV
./scripts/seed-dev-guest.sh
```

Expected: script exits with "FATAL: seed-dev-guest.sh can only run with PN_ENV=local..." and exit code 1.

- [ ] **Step 4: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add scripts/seed-dev-guest.sql scripts/seed-dev-guest.sh scripts/start-web-dev.sh
git commit -m "fix(dev): guard guest seed backdoor to local environment only"
```

---

## Task 4: ProcessManager — Fail Manager Startup Without Auth DSN

**Files:**
- Modify: `cmd/manager/main.go:62-77`
- Create: `cmd/manager/main_test.go`

**Interfaces:**
- Consumes: `AUTH_DATABASE_URL` env var / `-auth-dsn` flag.
- Produces: `deps.AuthMW` is always non-nil; startup fails hard when auth DSN is missing.

### Why
When `AUTH_DATABASE_URL` is unset, the manager logs a warning and runs with `deps.AuthMW = nil`, bypassing all auth.

### Steps

- [ ] **Step 1: Write the failing test**

Create `cmd/manager/main_test.go`:

```go
package main

import (
	"os"
	"testing"
)

func TestAuthDSNRequired(t *testing.T) {
	os.Unsetenv("AUTH_DATABASE_URL")
	// The main function cannot be called easily in a unit test; instead test the helper logic.
	if err := validateAuthDSN(""); err == nil {
		t.Fatal("expected error for empty auth DSN")
	}
}

func TestAuthDSNAccepted(t *testing.T) {
	if err := validateAuthDSN("postgres://user:pass@localhost/db"); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}
```

Run:

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
go test ./cmd/manager/... -run TestAuthDSN -v
```

Expected: FAIL (`validateAuthDSN` does not exist yet).

- [ ] **Step 2: Add validation helper and fail fast**

Add to `cmd/manager/main.go` after the imports:

```go
func validateAuthDSN(dsn string) error {
	if dsn == "" {
		return errors.New("AUTH_DATABASE_URL is required")
	}
	return nil
}
```

Add `errors` to the imports.

Modify the startup branch:

```go
if err := validateAuthDSN(*authDSN); err != nil {
	log.Fatalf("failed to validate auth configuration: %v", err)
}

ctx := context.Background()
pool, err := db.NewPool(ctx, *authDSN)
...
```

Remove the `else { log.Println("warning: AUTH_DATABASE_URL not set...") }` branch entirely.

- [ ] **Step 3: Run tests**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
go test ./cmd/manager/... -v
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
git add cmd/manager/main.go cmd/manager/main_test.go
git commit -m "fix(manager): fail startup when AUTH_DATABASE_URL is missing"
```

---

## Task 5: ProcessManager — Validate return_to / rd Redirects

**Files:**
- Create: `internal/auth/redirect.go`
- Create: `internal/auth/redirect_test.go`
- Modify: `internal/auth/handler.go:77-127`, `:379-389`

**Interfaces:**
- Consumes: `cookieDomain` string.
- Produces: `validateReturnTo(returnTo, cookieDomain) (string, error)`.

### Why
`return_to` / `rd` values are passed straight into `http.Redirect`, allowing phishing redirects to attacker-controlled hosts.

### Steps

- [ ] **Step 1: Write the failing test**

Create `internal/auth/redirect_test.go`:

```go
package auth

import "testing"

func TestValidateReturnTo(t *testing.T) {
	cookieDomain := "nacfson.cloud"
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"empty returns default", "", "https://nacfson.cloud", false},
		{"allowed path", "/processes", "https://nacfson.cloud/processes", false},
		{"allowed host", "https://manager.nacfson.cloud/foo", "https://manager.nacfson.cloud/foo", false},
		{"rejected external host", "https://evil.com", "", true},
		{"rejected schemeless", "//evil.com", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateReturnTo(tt.input, cookieDomain)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateReturnTo(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("validateReturnTo(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
```

Run:

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
go test ./internal/auth/... -run TestValidateReturnTo -v
```

Expected: FAIL (`validateReturnTo` undefined).

- [ ] **Step 2: Implement redirect validation**

Create `internal/auth/redirect.go`:

```go
package auth

import (
	"fmt"
	"net/url"
	"strings"
)

func validateReturnTo(returnTo, cookieDomain string) (string, error) {
	defaultURL := "https://" + cookieDomain
	if returnTo == "" {
		return defaultURL, nil
	}

	u, err := url.Parse(returnTo)
	if err != nil {
		return "", fmt.Errorf("invalid redirect URL: %w", err)
	}

	// Relative paths are allowed.
	if u.Scheme == "" && u.Host == "" {
		if !strings.HasPrefix(u.Path, "/") {
			return "", fmt.Errorf("relative redirect must start with /")
		}
		return defaultURL + u.Path, nil
	}

	if u.Scheme != "https" {
		return "", fmt.Errorf("redirect must use https")
	}

	host := strings.ToLower(u.Hostname())
	cookieDomain = strings.ToLower(strings.TrimPrefix(cookieDomain, "."))
	if host != cookieDomain && !strings.HasSuffix(host, "."+cookieDomain) {
		return "", fmt.Errorf("redirect host not allowed")
	}

	return u.String(), nil
}
```

- [ ] **Step 3: Use validator in login flow**

Modify `internal/auth/handler.go` `Login`:

```go
returnTo := r.FormValue("return_to")
validatedReturnTo, err := validateReturnTo(returnTo, h.cookieDomain)
if err != nil {
	h.redirectLogin(w, r, "invalid request")
	return
}
```

Replace the final `http.Redirect(w, r, returnTo, http.StatusFound)` with `http.Redirect(w, r, validatedReturnTo, http.StatusFound)`.

Modify `Logout`:

```go
validatedReturnTo, _ := validateReturnTo("", h.cookieDomain)
http.Redirect(w, r, validatedReturnTo, http.StatusFound)
```

Modify `redirectLogin` to use the validator on the stored `returnTo`:

```go
func (h *Handler) redirectLogin(w http.ResponseWriter, r *http.Request, message string) {
	returnTo := r.FormValue("return_to")
	if returnTo == "" {
		returnTo = r.URL.Query().Get("rd")
	}
	validatedReturnTo, err := validateReturnTo(returnTo, h.cookieDomain)
	if err != nil {
		validatedReturnTo, _ = validateReturnTo("", h.cookieDomain)
	}

	q := "?error=" + url.QueryEscape(message)
	q += "&rd=" + url.QueryEscape(validatedReturnTo)
	http.Redirect(w, r, "/login"+q, http.StatusFound)
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
go test ./internal/auth/... -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
git add internal/auth/redirect.go internal/auth/redirect_test.go internal/auth/handler.go
git commit -m "fix(auth): validate return_to / rd redirects against allowlist"
```

---

## Task 6: ProcessManager — Add Login Rate Limiting

**Files:**
- Create: `internal/auth/ratelimit.go`
- Create: `internal/auth/ratelimit_test.go`
- Modify: `internal/auth/handler.go:90-128`, `:139-187`
- Modify: `cmd/auth/main.go` (to construct the limiter)
- Modify: `internal/auth/handler.go` constructor signature

**Interfaces:**
- Consumes: rate-limit store keyed by IP and email.
- Produces: `(*Handler).loginAllowed(ip, email string) bool`.

### Why
Login endpoints accept unlimited attempts, enabling credential stuffing and brute-force attacks.

### Steps

- [ ] **Step 1: Write the failing test**

Create `internal/auth/ratelimit_test.go`:

```go
package auth

import (
	"net"
	"testing"
	"time"
)

func TestLoginLimiter(t *testing.T) {
	l := newLoginLimiter(3, time.Minute)
	ip := net.ParseIP("10.0.0.1")
	email := "user@example.com"

	for i := 0; i < 3; i++ {
		if !l.allow(ip, email) {
			t.Fatalf("attempt %d should be allowed", i+1)
		}
	}
	if l.allow(ip, email) {
		t.Fatal("4th attempt should be rate limited")
	}
}
```

Run:

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
go test ./internal/auth/... -run TestLoginLimiter -v
```

Expected: FAIL (`newLoginLimiter` undefined).

- [ ] **Step 2: Implement in-memory login limiter**

Create `internal/auth/ratelimit.go`:

```go
package auth

import (
	"fmt"
	"net"
	"sync"
	"time"
)

type loginLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	max      int
	window   time.Duration
}

func newLoginLimiter(max int, window time.Duration) *loginLimiter {
	return &loginLimiter{
		attempts: make(map[string][]time.Time),
		max:      max,
		window:   window,
	}
}

func (l *loginLimiter) allow(ip net.IP, email string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	key := fmt.Sprintf("%s|%s", ip.String(), email)
	now := time.Now()
	cutoff := now.Add(-l.window)

	var recent []time.Time
	for _, t := range l.attempts[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= l.max {
		l.attempts[key] = recent
		return false
	}

	recent = append(recent, now)
	l.attempts[key] = recent
	return true
}
```

- [ ] **Step 3: Wire limiter into handler**

Modify `internal/auth/handler.go`:

```go
type Handler struct {
	store             *Store
	cookieDomain      string
	sessionTTL        time.Duration
	apiAllowedOrigins []string
	tmpl              *template.Template
	loginLimiter      *loginLimiter
}
```

Modify `NewHandler` to accept the limiter:

```go
func NewHandler(store *Store, cookieDomain string, sessionTTL time.Duration, loginLimiter *loginLimiter, apiAllowedOrigins ...[]string) (*Handler, error) {
	...
	return &Handler{
		...
		loginLimiter: loginLimiter,
	}, nil
}
```

Add helper:

```go
func (h *Handler) loginAllowed(r *http.Request, email string) bool {
	if h.loginLimiter == nil {
		return true
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if host == "" {
		host = r.RemoteAddr
	}
	return h.loginLimiter.allow(net.ParseIP(host), email)
}
```

In `Login` and `APILogin`, after parsing email, add:

```go
if !h.loginAllowed(r, email) {
	h.redirectLogin(w, r, "too many attempts")
	return
}
```

(For APILogin, return a 429 JSON error instead.)

- [ ] **Step 4: Update auth service main**

Modify `cmd/auth/main.go` to create the limiter and pass it:

```go
limiter := auth.NewLoginLimiter(5, time.Minute)
handler, err := auth.NewHandler(store, cookieDomain, sessionTTL, limiter, allowedOrigins)
```

If the signature change breaks callers, update them all.

- [ ] **Step 5: Run tests**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
go test ./internal/auth/... ./cmd/auth/... -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
git add internal/auth/ratelimit.go internal/auth/ratelimit_test.go internal/auth/handler.go cmd/auth/main.go
git commit -m "feat(auth): add per-IP/email login rate limiting"
```

---

## Task 7: ProcessManager — Remove Committed Secrets from Manifests

**Files:**
- Modify: `k8s/auth/secret.yaml`
- Modify: `k8s/auth/admin-users-secret.yaml`
- Modify: `k8s/auth/bootstrap-secret.yaml`
- Modify: `k8s/data/secret.yaml`
- Modify: `k8s/project-pn/secret.yaml`
- Create: `k8s/README-secrets.md`

**Interfaces:**
- Consumes: external secret values supplied at deploy time.
- Produces: Manifests contain only placeholder values and clear instructions.

### Why
Multiple Kubernetes Secrets contain real-looking passwords committed to Git. History will retain them even after change, so they must be rotated after being removed.

### Steps

- [ ] **Step 1: Replace real passwords with placeholders**

Modify `k8s/auth/secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-db-secrets
  namespace: nacfson-auth
type: Opaque
stringData:
  POSTGRES_DB: "auth_db"
  POSTGRES_USER: "auth_user"
  POSTGRES_PASSWORD: "REPLACE_WITH_ROTATED_PASSWORD"
  DATABASE_URL: "postgres://auth_user:REPLACE_WITH_ROTATED_PASSWORD@auth-db.nacfson-auth.svc.cluster.local:5432/auth_db?sslmode=require"
```

(Note `sslmode=require` — part of the same fix.)

Modify `k8s/auth/admin-users-secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-admin-users
  namespace: nacfson-auth
type: Opaque
stringData:
  admins.yaml: |
    admins:
      - email: admin@nacfson.cloud
        password: REPLACE_WITH_STRONG_PASSWORD
```

Modify `k8s/auth/bootstrap-secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-bootstrap
  namespace: nacfson-auth
type: Opaque
stringData:
  BOOTSTRAP_ADMIN_EMAIL: "admin@nacfson.cloud"
  BOOTSTRAP_ADMIN_PASSWORD: "REPLACE_WITH_STRONG_PASSWORD"
```

Modify `k8s/data/secret.yaml` and `k8s/project-pn/secret.yaml` similarly, replacing every literal password/secret with `REPLACE_WITH_ROTATED_...` and changing `sslmode=disable` to `sslmode=require`.

- [ ] **Step 2: Document secret provisioning and rotation**

Create `k8s/README-secrets.md`:

```markdown
# Secret Management

Do not commit real credentials to this repository.

1. Generate strong passwords:
   ```bash
   openssl rand -base64 32
   ```
2. Apply secrets via `kubectl` from a local, non-committed file:
   ```bash
   kubectl apply -f k8s/secrets.local.yaml
   ```
3. If any committed secret was ever used in a real cluster, rotate it immediately in the database and in all downstream consumers.

For production, use Sealed Secrets, external-secrets, or SOPS instead of plain manifests.
```

- [ ] **Step 3: Verify no real passwords remain**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
grep -R "babPCW747bib9sECauU62KRV\|raxw9KnkldJ30soFzTuqYWX8\|CHANGE_ME_NOW" k8s/
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
cd /Users/hyungjuyu/Projects/Brain/ProcessManager
git add k8s/auth/secret.yaml k8s/auth/admin-users-secret.yaml k8s/auth/bootstrap-secret.yaml k8s/data/secret.yaml k8s/project-pn/secret.yaml k8s/README-secrets.md
git commit -m "fix(k8s): replace committed secrets with placeholders and document rotation"
```

---

## Self-Review

**Spec coverage:**
- Critical auth bypass via proxy headers → Task 1.
- Hardcoded DB password fallback → Task 2.
- Dev guest backdoor → Task 3.
- Manager unprotected startup → Task 4.
- Open redirect → Task 5.
- No login rate limiting → Task 6.
- Committed secrets → Task 7.

**Placeholder scan:**
- No "TBD", "TODO", or "implement later".
- "REPLACE_WITH_..." strings are intentional placeholders in K8s manifests because real secrets must never be committed.

**Type consistency:**
- `validateReturnTo` signature is consistent across handler and tests.
- `newLoginLimiter` / `loginLimiter` naming is consistent.
- `validateAuthDSN` helper is used before DB pool creation.

**Cross-project dependency:**
- Task 1 removes the client-supplied `X-User-*` forwarding in Project PN nginx. If ProcessManager's ingress is later used for Project PN, the same header-stripping rule must be applied there. This is noted but not in scope for this plan.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-30-auth-critical-security-remediation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach would you like to use?
