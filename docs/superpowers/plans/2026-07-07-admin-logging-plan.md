# Admin Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal file-only admin logging subsystem to the Project PN Go backend that emits plain-text, one-line audit and metric logs to a configurable file path.

**Architecture:** A new `internal/admin` package provides a `Logger`, a `MetricsCollector`, and an HTTP middleware. Existing handlers call the logger at key events. A background goroutine flushes metrics every 60 seconds. No database tables, no admin API endpoints, and no frontend UI are added.

**Tech Stack:** Go 1.22+, standard library, existing `internal/http` and `internal/words` packages.

## Global Constraints

- Backend target is local PostgreSQL; no new DB tables or migrations.
- Use plain-text, one-line log format: `<RFC3339> [<CATEGORY>] <message>`.
- Default log path is `/var/log/project-pn/admin.log`; disable when `ADMIN_LOG_PATH` is empty.
- Logger failures must not fail the original HTTP request.
- No external logging libraries; use `log/slog` only for operational warnings.
- Follow existing file naming, package layout, and chi router patterns.
- All new code must have unit tests in the same package.

---

## File Map

| File | Responsibility |
|------|----------------|
| `backend/internal/config/config.go` | Load `ADMIN_LOG_PATH` env var into `Config.AdminLogPath`. |
| `backend/internal/admin/logger.go` | `Logger` interface, `NoopLogger`, and `FileLogger` that writes timestamped lines. |
| `backend/internal/admin/metrics.go` | `MetricsCollector` with request/error/latency/active-user counters and a `Flush` method. |
| `backend/internal/admin/middleware.go` | `HTTPLoggingMiddleware` that updates metrics and logs 5xx responses. |
| `backend/cmd/api/main.go` | Initialize logger, metrics collector, and background flush goroutine; pass to router. |
| `backend/internal/http/router.go` | Add `AdminLogger` and `MetricsCollector` to `Dependencies`; wire middleware. |
| `backend/internal/http/auth_middleware.go` | Log `AUTH_FAILURE` and `VERIFY_REQUIRED`. |
| `backend/internal/http/auth_handler.go` | Log `AUTH` on `/api/auth/me` and `/api/auth/logout`. |
| `backend/internal/http/words_handler.go` | Log `ADD_ITEM`; pass logger to `words.Service`. |
| `backend/internal/words/service.go` | Accept an admin logger; log `ADD_WORD` and `ENRICH_FAIL`. |
| `backend/internal/http/deck_handler.go` | Log `DECK_CREATED`. |
| `backend/.env.example` | Document `ADMIN_LOG_PATH`. |

---

## Task 1: Add `ADMIN_LOG_PATH` to configuration

**Files:**
- Modify: `backend/internal/config/config.go`
- Test: `backend/internal/config/config_test.go`

**Interfaces:**
- Consumes: none.
- Produces: `Config.AdminLogPath string` populated from `ADMIN_LOG_PATH` env var.

- [ ] **Step 1: Write the failing test**

```go
func TestLoad_AdminLogPathDefault(t *testing.T) {
	os.Unsetenv("ADMIN_LOG_PATH")
	cfg := Load()
	if cfg.AdminLogPath != "/var/log/project-pn/admin.log" {
		t.Fatalf("expected default admin log path, got %q", cfg.AdminLogPath)
	}
}

func TestLoad_AdminLogPathFromEnv(t *testing.T) {
	t.Setenv("ADMIN_LOG_PATH", "/tmp/test-admin.log")
	cfg := Load()
	if cfg.AdminLogPath != "/tmp/test-admin.log" {
		t.Fatalf("expected env admin log path, got %q", cfg.AdminLogPath)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && go test ./internal/config -run TestLoad_AdminLogPath -v
```

Expected: FAIL — `Config.AdminLogPath undefined`.

- [ ] **Step 3: Add the config field and loader**

In `backend/internal/config/config.go`:

1. Add a constant near the top:

```go
const defaultAdminLogPath = "/var/log/project-pn/admin.log"
```

2. Add the field to `Config`:

```go
AdminLogPath string
```

3. Add the loader line in `Load()`:

```go
AdminLogPath: envOrDefault("ADMIN_LOG_PATH", defaultAdminLogPath),
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && go test ./internal/config -run TestLoad_AdminLogPath -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/config/config.go backend/internal/config/config_test.go
git commit -m "config: add ADMIN_LOG_PATH for admin logging"
```

---

## Task 2: Create the `internal/admin` logger package

**Files:**
- Create: `backend/internal/admin/logger.go`
- Create: `backend/internal/admin/logger_test.go`

**Interfaces:**
- Consumes: `ADMIN_LOG_PATH` value via `NewLogger(path string)`.
- Produces:
  - `type Logger interface { Log(category, message string); Logf(category, format string, args ...interface{}); Close() error }`
  - `func NewLogger(path string) (Logger, error)` — returns `NoopLogger` when path is empty or on error.
  - `type NoopLogger struct{}` with no-op implementations.
  - `type FileLogger struct{...}` that writes lines safely under a mutex.

- [ ] **Step 1: Write the failing test**

Create `backend/internal/admin/logger_test.go`:

```go
package admin

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewLogger_EmptyPath_ReturnsNoop(t *testing.T) {
	logger, err := NewLogger("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := logger.(NoopLogger); !ok {
		t.Fatalf("expected NoopLogger, got %T", logger)
	}
}

func TestFileLogger_Log(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "admin.log")
	logger, err := NewLogger(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer logger.Close()

	logger.Log("AUTH", "user logged in")
	logger.Logf("METRICS", "last %ds: %d requests", 60, 42)

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}
	if !strings.Contains(lines[0], "[AUTH] user logged in") {
		t.Fatalf("unexpected first line: %s", lines[0])
	}
	if !strings.Contains(lines[1], "[METRICS] last 60s: 42 requests") {
		t.Fatalf("unexpected second line: %s", lines[1])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && go test ./internal/admin -run TestNewLogger -v
```

Expected: FAIL — `package admin: no Go files` or undefined symbols.

- [ ] **Step 3: Implement the logger**

Create `backend/internal/admin/logger.go`:

```go
package admin

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Logger emits one-line admin audit logs.
type Logger interface {
	Log(category, message string)
	Logf(category, format string, args ...interface{})
	Close() error
}

// NoopLogger discards all log output.
type NoopLogger struct{}

func (NoopLogger) Log(string, string)                   {}
func (NoopLogger) Logf(string, string, ...interface{}) {}
func (NoopLogger) Close() error                         { return nil }

// FileLogger writes timestamped lines to a file.
type FileLogger struct {
	mu sync.Mutex
	w  io.WriteCloser
}

// NewLogger creates a Logger. An empty path returns a NoopLogger.
func NewLogger(path string) (Logger, error) {
	if path == "" {
		return NoopLogger{}, nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		return NoopLogger{}, fmt.Errorf("admin log: create directory: %w", err)
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return NoopLogger{}, fmt.Errorf("admin log: open file: %w", err)
	}
	return &FileLogger{w: f}, nil
}

func (l *FileLogger) Log(category, message string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	ts := time.Now().UTC().Format(time.RFC3339)
	_, _ = fmt.Fprintf(l.w, "%s [%s] %s\n", ts, category, message)
}

func (l *FileLogger) Logf(category, format string, args ...interface{}) {
	l.Log(category, fmt.Sprintf(format, args...))
}

func (l *FileLogger) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.w == nil {
		return nil
	}
	return l.w.Close()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && go test ./internal/admin -run TestNewLogger -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/admin/logger.go backend/internal/admin/logger_test.go
git commit -m "feat(admin): add file logger for admin audit logs"
```

---

## Task 3: Create the metrics collector

**Files:**
- Create: `backend/internal/admin/metrics.go`
- Create: `backend/internal/admin/metrics_test.go`

**Interfaces:**
- Consumes: `Logger` from Task 2.
- Produces:
  - `func NewMetricsCollector() *MetricsCollector`
  - `func (c *MetricsCollector) RecordRequest(statusCode int, latencyMs int64, userID string)`
  - `func (c *MetricsCollector) Flush(logger Logger)` — emits one `[METRICS]` line and resets counters.

- [ ] **Step 1: Write the failing test**

Create `backend/internal/admin/metrics_test.go`:

```go
package admin

import (
	"fmt"
	"testing"
)

type fakeLogger struct {
	logs []string
}

func (f *fakeLogger) Log(category, message string) {
	f.logs = append(f.logs, category+": "+message)
}

func (f *fakeLogger) Logf(category, format string, args ...interface{}) {
	f.Log(category, fmt.Sprintf(format, args...))
}

func (f *fakeLogger) Close() error { return nil }

func TestMetricsCollector_Flush(t *testing.T) {
	col := NewMetricsCollector()
	col.RecordRequest(200, 40, "user-1")
	col.RecordRequest(500, 120, "user-2")
	col.RecordRequest(200, 20, "user-1")

	logger := &fakeLogger{}
	col.Flush(logger)

	if len(logger.logs) != 1 {
		t.Fatalf("expected 1 log, got %d", len(logger.logs))
	}
	expected := "METRICS: last 60s: 3 requests, 1 errors, avg latency 60ms, 2 active users"
	if logger.logs[0] != expected {
		t.Fatalf("expected %q, got %q", expected, logger.logs[0])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && go test ./internal/admin -run TestMetricsCollector -v
```

Expected: FAIL — undefined `MetricsCollector`.

- [ ] **Step 3: Implement the metrics collector**

Create `backend/internal/admin/metrics.go`:

```go
package admin

import "sync"

// MetricsCollector holds request counters for periodic emission.
type MetricsCollector struct {
	mu             sync.Mutex
	requestCount   int64
	errorCount     int64
	totalLatencyMs int64
	activeUsers    map[string]struct{}
}

// NewMetricsCollector creates a collector with empty counters.
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{activeUsers: make(map[string]struct{})}
}

// RecordRequest updates counters with one request.
func (c *MetricsCollector) RecordRequest(statusCode int, latencyMs int64, userID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.requestCount++
	if statusCode >= 500 {
		c.errorCount++
	}
	c.totalLatencyMs += latencyMs
	if userID != "" {
		c.activeUsers[userID] = struct{}{}
	}
}

// Flush writes a METRICS line using the provided logger and resets counters.
func (c *MetricsCollector) Flush(logger Logger) {
	c.mu.Lock()
	count := c.requestCount
	errors := c.errorCount
	latency := c.totalLatencyMs
	users := len(c.activeUsers)
	c.requestCount = 0
	c.errorCount = 0
	c.totalLatencyMs = 0
	c.activeUsers = make(map[string]struct{})
	c.mu.Unlock()

	var avg int64
	if count > 0 {
		avg = latency / count
	}
	logger.Logf("METRICS", "last 60s: %d requests, %d errors, avg latency %dms, %d active users", count, errors, avg, users)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && go test ./internal/admin -run TestMetricsCollector -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/admin/metrics.go backend/internal/admin/metrics_test.go
git commit -m "feat(admin): add metrics collector for periodic status logs"
```

---

## Task 4: Create HTTP logging middleware

**Files:**
- Create: `backend/internal/admin/middleware.go`
- Create: `backend/internal/admin/middleware_test.go`

**Interfaces:**
- Consumes: `Logger` (Task 2), `MetricsCollector` (Task 3), and a `userIDFromRequest func(*http.Request) string` callback.
- Produces: `func HTTPLoggingMiddleware(logger Logger, collector *MetricsCollector, userIDFromRequest func(*http.Request) string) func(http.Handler) http.Handler`.

- [ ] **Step 1: Write the failing test**

Create `backend/internal/admin/middleware_test.go`:

```go
package admin

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPLoggingMiddleware_Logs5xxAndRecordsMetrics(t *testing.T) {
	logger := &fakeLogger{}
	collector := NewMetricsCollector()

	mw := HTTPLoggingMiddleware(logger, collector, func(r *http.Request) string { return "user-1" })
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}

	collector.Flush(logger)

	if len(logger.logs) != 2 {
		t.Fatalf("expected 2 logs, got %d: %v", len(logger.logs), logger.logs)
	}
	if !contains(logger.logs[0], "[ERROR]") {
		t.Fatalf("expected ERROR log, got %s", logger.logs[0])
	}
	if !contains(logger.logs[1], "[METRICS]") {
		t.Fatalf("expected METRICS log, got %s", logger.logs[1])
	}
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
```

Add `
`strings` to the imports in `backend/internal/admin/middleware_test.go`:

```go
import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && go test ./internal/admin -run TestHTTPLoggingMiddleware -v
```

Expected: FAIL — undefined `HTTPLoggingMiddleware`.

- [ ] **Step 3: Implement the middleware**

Create `backend/internal/admin/middleware.go`:

```go
package admin

import (
	"net/http"
	"time"
)

// HTTPLoggingMiddleware records request metrics and logs 5xx responses.
func HTTPLoggingMiddleware(logger Logger, collector *MetricsCollector, userIDFromRequest func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(ww, r)

			latencyMs := time.Since(start).Milliseconds()
			userID := ""
			if userIDFromRequest != nil {
				userID = userIDFromRequest(r)
			}
			collector.RecordRequest(ww.statusCode, latencyMs, userID)
			if ww.statusCode >= 500 {
				logger.Logf("ERROR", "%s %s returned %d in %dms", r.Method, r.URL.Path, ww.statusCode, latencyMs)
			}
		})
	}
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
	wrote      bool
}

func (w *loggingResponseWriter) WriteHeader(code int) {
	if !w.wrote {
		w.statusCode = code
		w.wrote = true
		w.ResponseWriter.WriteHeader(code)
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && go test ./internal/admin -run TestHTTPLoggingMiddleware -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/admin/middleware.go backend/internal/admin/middleware_test.go
git commit -m "feat(admin): add HTTP logging middleware for metrics and errors"
```

---

## Task 5: Wire logger and metrics into the application

**Files:**
- Modify: `backend/cmd/api/main.go`
- Modify: `backend/internal/http/router.go`

**Interfaces:**
- Consumes: `Config.AdminLogPath`, `admin.Logger`, `admin.MetricsCollector`.
- Produces: `Dependencies.AdminLogger` and `Dependencies.MetricsCollector` wired into the router.

- [ ] **Step 1: Modify `cmd/api/main.go` to initialize the subsystem**

After `cfg := config.Load()` and before building services, add:

```go
adminLogger, err := admin.NewLogger(cfg.AdminLogPath)
if err != nil {
	slog.Warn("admin logger disabled", "error", err)
}
metricsCollector := admin.NewMetricsCollector()

metricsCtx, stopMetrics := context.WithCancel(ctx)
defer stopMetrics()
if _, ok := adminLogger.(admin.NoopLogger); !ok {
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-metricsCtx.Done():
				return
			case <-ticker.C:
				metricsCollector.Flush(adminLogger)
			}
		}
	}()
}
```

Import `"project-pn/internal/admin"` at the top.

Change the router dependencies to include:

```go
Handler: httpapi.NewRouter(httpapi.Dependencies{
	DB:               pool,
	Words:            wordsService,
	Auth:             authService,
	CentralAuth:      centralAuth,
	AllowedOrigins:   cfg.AllowedOrigins,
	AdminLogger:      adminLogger,
	MetricsCollector: metricsCollector,
}),
```

- [ ] **Step 2: Add fields to `Dependencies` and wire middleware**

In `backend/internal/http/router.go`:

1. Add imports:

```go
import (
	...
	"project-pn/internal/admin"
)
```

2. Add fields to `Dependencies`:

```go
type Dependencies struct {
	DB               *pgxpool.Pool
	Words            *words.Service
	Auth             *auth.Service
	CentralAuth      *auth.CentralClient
	AllowedOrigins   []string
	AdminLogger      admin.Logger
	MetricsCollector *admin.MetricsCollector
}
```

3. Wire the middleware early in `NewRouter`, after `middleware.Recoverer`:

```go
r.Use(middleware.RequestID)
r.Use(middleware.RealIP)
r.Use(middleware.Recoverer)

if deps.AdminLogger != nil && deps.MetricsCollector != nil {
	r.Use(admin.HTTPLoggingMiddleware(deps.AdminLogger, deps.MetricsCollector, func(r *http.Request) string {
		return userIDFromRequest(r)
	}))
}
```

- [ ] **Step 3: Build to verify**

Run:
```bash
cd backend && go build ./cmd/api
```

Expected: PASS (no output).

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/api/main.go backend/internal/http/router.go
git commit -m "feat(admin): wire admin logger and metrics into router"
```

---

## Task 6: Add auth-related logs

**Files:**
- Modify: `backend/internal/http/auth_middleware.go`
- Modify: `backend/internal/http/auth_handler.go`
- Modify: `backend/internal/http/router.go`

**Interfaces:**
- Consumes: `admin.Logger`.
- Produces: `AUTH_FAILURE`, `VERIFY_REQUIRED`, and `AUTH` log lines.

- [ ] **Step 1: Update `authMiddleware` signature and add `AUTH_FAILURE` logging**

In `backend/internal/http/auth_middleware.go`:

1. Add import:

```go
import (
	"net/http"
	"strings"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)
```

2. Change the signature:

```go
func authMiddleware(svc *auth.Service, central *auth.CentralClient, logger admin.Logger) func(http.Handler) http.Handler {
```

3. Log failures:

```go
session, err := central.ValidateSession(r.Context(), token)
if err != nil {
	logger.Logf("AUTH_FAILURE", "session validation failed from %s: %v", r.RemoteAddr, err)
	writeError(w, http.StatusUnauthorized, "unauthorized")
	return
}
```

- [ ] **Step 2: Update `requireVerified` to log `VERIFY_REQUIRED`**

Change signature:

```go
func requireVerified(logger admin.Logger) func(http.Handler) http.Handler {
```

Add log line:

```go
if !ok || !user.IsEmailVerified() {
	if ok {
		logger.Logf("VERIFY_REQUIRED", "%s requested %s %s but email is not verified", user.Email, r.Method, r.URL.Path)
	}
	writeError(w, http.StatusForbidden, "email verification required")
	return
}
```

- [ ] **Step 3: Update `authHandler` and logout to log `AUTH`**

In `backend/internal/http/auth_handler.go`:

1. Add import:

```go
import (
	"net/http"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)
```

2. Add `logger` field:

```go
type authHandler struct {
	svc    *auth.Service
	logger admin.Logger
}
```

3. Log in `me`:

```go
func (h *authHandler) me(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	h.logger.Logf("AUTH", "%s identity confirmed from %s", user.Email, r.RemoteAddr)
	writeJSON(w, http.StatusOK, meResponse{
		ID:              user.ID,
		Email:           user.Email,
		EmailVerified:   user.IsEmailVerified(),
		EmailVerifiedAt: user.EmailVerifiedAt,
		NativeLanguage:  user.NativeLanguage,
		TargetLanguage:  user.TargetLanguage,
		UILanguage:      user.UILanguage,
		ActiveLanguage:  user.ActiveLanguage,
	})
}
```

4. Change `centralLogout` to accept logger:

```go
func centralLogout(central *auth.CentralClient, logger admin.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if central == nil {
			writeError(w, http.StatusInternalServerError, "central auth is not configured")
			return
		}
		token := bearerToken(r)
		if err := central.Logout(r.Context(), token); err != nil {
			logger.Logf("AUTH_FAILURE", "logout failed for token from %s: %v", r.RemoteAddr, err)
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		logger.Logf("AUTH", "logout from %s", r.RemoteAddr)
		w.WriteHeader(http.StatusNoContent)
	}
}
```

- [ ] **Step 4: Update router call sites**

In `backend/internal/http/router.go`:

```go
authMW = authMiddleware(deps.Auth, deps.CentralAuth, deps.AdminLogger)
ah := &authHandler{svc: deps.Auth, logger: deps.AdminLogger}
...
protected.Post("/logout", centralLogout(deps.CentralAuth, deps.AdminLogger))
...
protected.Use(requireVerified(deps.AdminLogger))
```

- [ ] **Step 5: Build to verify**

Run:
```bash
cd backend && go build ./cmd/api
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/http/auth_middleware.go backend/internal/http/auth_handler.go backend/internal/http/router.go
git commit -m "feat(admin): log auth and verification events"
```

---

## Task 7: Add business handler logs

**Files:**
- Modify: `backend/internal/http/words_handler.go`
- Modify: `backend/internal/http/deck_handler.go`
- Modify: `backend/internal/words/service.go`
- Modify: `backend/internal/http/router.go`
- Modify: `backend/cmd/api/main.go`

**Interfaces:**
- Consumes: `admin.Logger`.
- Produces: `ADD_WORD`, `ADD_ITEM`, `ENRICH_FAIL`, and `DECK_CREATED` log lines.

- [ ] **Step 1: Add logger to `words.Service` and log enrich failures / new words**

In `backend/internal/words/service.go`:

1. Add import:

```go
import (
	...
	"project-pn/internal/admin"
)
```

2. Add field:

```go
type Service struct {
	pool         *pgxpool.Pool
	enricher     enrich.Enricher
	adminLogger  admin.Logger
	...
}
```

3. Update constructor signature and assignment:

```go
func New(pool *pgxpool.Pool, enricher enrich.Enricher, adminLogger admin.Logger, defaultUserID, targetLang, definitionLang string) *Service {
	return &Service{
		pool:           pool,
		enricher:       enricher,
		adminLogger:    adminLogger,
		DefaultUserID:  defaultUserID,
		TargetLang:     targetLang,
		DefinitionLang: definitionLang,
	}
}
```

4. Log enrich failure in `Lookup`:

```go
result, err := s.enricher.Enrich(ctx, enrich.Request{
	Text:                   normalized,
	LanguageCode:           langCode,
	DefinitionLanguageCode: defLangCode,
	POS:                    posHint,
})
if err != nil {
	s.adminLogger.Logf("ENRICH_FAIL", "enricher failed for word '%s': %v", normalized, err)
	return LookupResult{}, err
}
```

5. Log new words in `persistEntries` after successful commit:

```go
if err := tx.Commit(ctx); err != nil {
	return nil, err
}

for _, wordID := range wordIDs {
	var lemma, langCode, pos string
	_ = s.pool.QueryRow(ctx, `select lemma, language_code, part_of_speech from words where id = $1::uuid`, wordID).Scan(&lemma, &langCode, &pos)
	s.adminLogger.Logf("ADD_WORD", "created word '%s' (%s, %s)", lemma, langCode, pos)
}
```

- [ ] **Step 2: Update `wordsHandler` to log `ADD_ITEM`**

In `backend/internal/http/words_handler.go`:

1. Add import:

```go
import (
	...
	"project-pn/internal/admin"
)
```

2. Add field:

```go
type wordsHandler struct {
	svc    *words.Service
	logger admin.Logger
}
```

3. Log in `addLearningItem` after success:

```go
item, err := h.svc.AddLearningItem(r.Context(), userIDFromRequest(r), req.WordSenseID, req.DisplayLanguageCode, req.DeckID)
if err != nil {
	h.writeServiceError(w, err)
	return
}
h.logger.Logf("ADD_ITEM", "%s added learning item word_sense_id=%s", userIDFromRequest(r), item.WordSenseID)
writeJSON(w, http.StatusCreated, item)
```

- [ ] **Step 3: Update `deckHandler` to log `DECK_CREATED`**

In `backend/internal/http/deck_handler.go`:

1. Add import:

```go
import (
	...
	"project-pn/internal/admin"
)
```

2. Add field:

```go
type deckHandler struct {
	svc    *words.Service
	logger admin.Logger
}
```

3. Log in `createDeck` after success:

```go
deck, err := h.svc.CreateDeck(r.Context(), userIDFromRequest(r), req.Name, req.TargetLanguage)
if err != nil {
	h.writeDeckError(w, err)
	return
}
h.logger.Logf("DECK_CREATED", "%s created deck '%s' (%s)", userIDFromRequest(r), deck.Name, deck.TargetLanguage)
writeJSON(w, http.StatusCreated, deck)
```

- [ ] **Step 4: Update `router.go` and `main.go` call sites**

In `backend/cmd/api/main.go`:

```go
wordsService := words.New(pool, enricher, adminLogger, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)
```

In `backend/internal/http/router.go`:

```go
wh := &wordsHandler{svc: deps.Words, logger: deps.AdminLogger}
...
dh := &deckHandler{svc: deps.Words, logger: deps.AdminLogger}
```

- [ ] **Step 5: Build to verify**

Run:
```bash
cd backend && go build ./cmd/api
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/words/service.go backend/internal/http/words_handler.go backend/internal/http/deck_handler.go backend/internal/http/router.go backend/cmd/api/main.go
git commit -m "feat(admin): log word, learning item, deck, and enrich events"
```

---

## Task 8: Update environment example and run final checks

**Files:**
- Modify: `backend/.env.example`
- Test: run all backend tests.

- [ ] **Step 1: Document `ADMIN_LOG_PATH` in `.env.example`**

Append to `backend/.env.example`:

```text
# Admin audit log file path. Empty value disables admin logging.
ADMIN_LOG_PATH=/var/log/project-pn/admin.log
```

- [ ] **Step 2: Run the full backend test suite**

Run:
```bash
cd backend && go test ./...
```

Expected: PASS (all existing tests plus new ones).

- [ ] **Step 3: Verify the binary still builds**

Run:
```bash
cd backend && go build ./cmd/api
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example
git commit -m "docs: document ADMIN_LOG_PATH in .env.example"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every log category in the spec (`AUTH`, `AUTH_FAILURE`, `VERIFY_REQUIRED`, `ADD_WORD`, `ADD_ITEM`, `DECK_CREATED`, `METRICS`, `ERROR`, `ENRICH_FAIL`) has a corresponding implementation task.
- [ ] **No placeholders:** No `TBD`, `TODO`, or vague instructions remain.
- [ ] **Type consistency:** `admin.Logger` and `admin.MetricsCollector` types are consistent across all tasks; constructor signatures match.
- [ ] **No DB changes:** No migration files or schema changes are included.
- [ ] **No frontend changes:** No frontend files are touched.
- [ ] **Error handling:** Logger failures never fail requests; `NoopLogger` is returned on errors.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-07-admin-logging-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
