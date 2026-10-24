# URL + Model Only AI Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `Project_PN` enrichment to `WiktApi first => miss => LLM (URL + Model only)`, removing all API keys (`ENRICH_PRIMARY_API_KEY`), secondary fallbacks (`ENRICH_FALLBACK_*`), phrase-first routing (`PhrasePreferLLM`), and silent phrase drafts (`phraseDraftEntry`), and stopping with stdout error logs when the LLM fails.

**Architecture:** `internal/config` retains only `OriginWiktAPIBaseURL`, `EnrichPrimaryBaseURL`, and `EnrichPrimaryModel` (removing all API keys, external Gemini default URLs, and `EnrichFallback*`). `internal/enrich.OpenAIEnricher` takes `(baseURL, model string)` without an `Authorization` header and logs non-200/transport errors directly to `os.Stdout`. `cmd/api/main.go` and `cmd/retranslate-senses/main.go` wire `WiktAPI` -> `OpenAIEnricher` via `NewFallback`, and `internal/words.Service.Lookup` stops and logs to `os.Stdout` on enrichment failure.

**Tech Stack:** Go 1.26 (`internal/config`, `internal/enrich`, `internal/words`, `internal/http`, `cmd/api`, `cmd/retranslate-senses`), Kubernetes `NetworkPolicy`.

**Spec:** `docs/superpowers/specs/2026-10-24-openbao-ai-proxy-design.md`

## Global Constraints

- Run backend Go tests serially with `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`.
- `OpenAIEnricher` must not accept or send an API key; it sends only to `BaseURL` with `Model`.
- Default `EnrichPrimaryModel` when `EnrichPrimaryBaseURL` is non-empty and `ENRICH_PRIMARY_MODEL` is unset: `gemini-3.1-flash-lite`.
- On LLM HTTP/transport error or Lookup enrich failure, log to `os.Stdout` and return the error immediately.

## Review Focus

1. `ENRICH_PRIMARY_BASE_URL` unset (even if `ENRICH_PRIMARY_MODEL` is set) must leave `EnrichPrimaryBaseURL` and `EnrichPrimaryModel` empty so the backend runs WiktApi-only and never defaults to `https://generativelanguage.googleapis.com`.
2. `ENRICH_PRIMARY_BASE_URL` set with empty `ENRICH_PRIMARY_MODEL` must trim whitespace/trailing slashes on `EnrichPrimaryBaseURL` and default `EnrichPrimaryModel` to `gemini-3.1-flash-lite`.
3. `OpenAIEnricher` called with empty `BaseURL` or empty `Model` must return `ErrNotConfigured` without making an HTTP request.
4. `OpenAIEnricher` receiving a non-200 HTTP status code (e.g. `502` or `500`) must write an error log line containing the status code and model to `os.Stdout` (or its configured stdout writer) and return `ErrUnavailable`.
5. Multi-word phrase lookup when `Enricher` fails must NOT create a `phraseDraftEntry` sense; it must log the error to `os.Stdout` and return the error.

---

### Task 1: Simplify `internal/config` to `ENRICH_PRIMARY_BASE_URL` + `ENRICH_PRIMARY_MODEL` Only

**Files:**
- Modify: `backend/internal/config/config.go:40-65,105-140`
- Modify: `backend/.env.example:11-21`
- Test: `backend/internal/config/config_test.go`

**Interfaces:**
- Consumes: `envOrDefault(key, fallback string) string` in `backend/internal/config/config.go`
- Produces: `Config.OriginWiktAPIBaseURL string`, `Config.EnrichPrimaryBaseURL string`, `Config.EnrichPrimaryModel string` (removes `EnrichPrimaryAPIKey`, `EnrichFallbackBaseURL`, `EnrichFallbackAPIKey`, `EnrichFallbackModel`, and `defaultEnrichPrimaryBaseURL`)

- [ ] **Step 1: Write the failing unit tests in `backend/internal/config/config_test.go`**

Append tests to `backend/internal/config/config_test.go`:

```go
func TestLoad_EnrichDefaultEmpty(t *testing.T) {
	t.Setenv("ENRICH_PRIMARY_BASE_URL", "")
	t.Setenv("ENRICH_BASE_URL", "")
	t.Setenv("ENRICH_PRIMARY_MODEL", "")
	t.Setenv("ENRICH_MODEL", "")

	cfg := Load()
	if cfg.EnrichPrimaryBaseURL != "" || cfg.EnrichPrimaryModel != "" {
		t.Fatalf("expected empty enrich primary config by default, got base=%q model=%q",
			cfg.EnrichPrimaryBaseURL, cfg.EnrichPrimaryModel)
	}
}

func TestLoad_EnrichBaseURLSetsDefaultModel(t *testing.T) {
	t.Setenv("ENRICH_PRIMARY_BASE_URL", "  http://ai-gateway.vault.svc:8080/v1/  ")
	t.Setenv("ENRICH_BASE_URL", "")
	t.Setenv("ENRICH_PRIMARY_MODEL", "")
	t.Setenv("ENRICH_MODEL", "")

	cfg := Load()
	if cfg.EnrichPrimaryBaseURL != "http://ai-gateway.vault.svc:8080/v1" {
		t.Fatalf("expected trimmed base URL, got %q", cfg.EnrichPrimaryBaseURL)
	}
	if cfg.EnrichPrimaryModel != "gemini-3.1-flash-lite" {
		t.Fatalf("expected default model gemini-3.1-flash-lite, got %q", cfg.EnrichPrimaryModel)
	}
}

func TestLoad_EnrichModelIgnoredWhenBaseURLEmpty(t *testing.T) {
	t.Setenv("ENRICH_PRIMARY_BASE_URL", "   ")
	t.Setenv("ENRICH_BASE_URL", "")
	t.Setenv("ENRICH_PRIMARY_MODEL", "custom-model")

	cfg := Load()
	if cfg.EnrichPrimaryBaseURL != "" || cfg.EnrichPrimaryModel != "" {
		t.Fatalf("expected empty config when base URL is blank, got base=%q model=%q",
			cfg.EnrichPrimaryBaseURL, cfg.EnrichPrimaryModel)
	}
}
```

- [ ] **Step 2: Run the config tests to verify they fail**

Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 -v ./internal/config -run "TestLoad_Enrich"`
Expected: FAIL on `TestLoad_EnrichBaseURLSetsDefaultModel` and `TestLoad_EnrichModelIgnoredWhenBaseURLEmpty`.

- [ ] **Step 3: Update `backend/internal/config/config.go` and `backend/.env.example`**

1. In `backend/internal/config/config.go`:
   - Remove `defaultEnrichPrimaryBaseURL` (`"https://generativelanguage.googleapis.com/v1beta/openai"`).
   - Remove `EnrichPrimaryAPIKey`, `EnrichFallbackBaseURL`, `EnrichFallbackAPIKey`, `EnrichFallbackModel` from `Config`.
   - In `Load()`, trim whitespace and trailing `/` from `envOrDefault("ENRICH_PRIMARY_BASE_URL", os.Getenv("ENRICH_BASE_URL"))`. When non-empty, set `EnrichPrimaryModel` to `strings.TrimSpace(envOrDefault("ENRICH_PRIMARY_MODEL", os.Getenv("ENRICH_MODEL")))` (defaulting to `defaultEnrichPrimaryModel` if empty). When `EnrichPrimaryBaseURL` is empty, set `EnrichPrimaryModel` to `""`.
2. In `backend/.env.example`:
   - Keep `ORIGIN_WIKTAPI_BASE_URL=https://api.wiktapi.dev`, `ENRICH_PRIMARY_BASE_URL=`, and `ENRICH_PRIMARY_MODEL=`.
   - Remove `ENRICH_PRIMARY_API_KEY`, `ENRICH_FALLBACK_BASE_URL`, `ENRICH_FALLBACK_API_KEY`, and `ENRICH_FALLBACK_MODEL`.

- [ ] **Step 4: Run the config tests to verify they pass**

Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 -v ./internal/config`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/config/config.go backend/internal/config/config_test.go backend/.env.example
git commit -m "feat(config): keep only ENRICH_PRIMARY_BASE_URL and ENRICH_PRIMARY_MODEL"
```

---

### Task 2: Update `OpenAIEnricher` to URL + Model Only with Stdout Error Logging

**Files:**
- Modify: `backend/internal/enrich/openai.go:53-72,132-160,213-236`
- Modify: `backend/internal/enrich/openai_test.go`
- Delete: `backend/internal/enrich/phrase_route.go`
- Delete: `backend/internal/enrich/phrase_route_test.go`

**Interfaces:**
- Consumes: `Enricher`, `Request`, `Result`, `TranslateRequest`, `TranslateResult` in `backend/internal/enrich/enrich.go`
- Produces: `NewOpenAI(baseURL, model string) *OpenAIEnricher` in `backend/internal/enrich/openai.go`

- [ ] **Step 1: Update `backend/internal/enrich/openai_test.go` with failing tests for URL+Model signature and stdout error logging**

Update `NewOpenAI` calls in `backend/internal/enrich/openai_test.go` to `NewOpenAI(baseURL, model)` (2 arguments), remove the `Authorization` header assertion in `TestOpenAIEnricher_Success`, and add:

```go
func TestOpenAIEnricher_LogsErrorToStdoutOnHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "" {
			t.Errorf("expected no Authorization header, got %q", got)
		}
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"error":"upstream gateway error"}`))
	}))
	defer srv.Close()

	var buf bytes.Buffer
	enricher := NewOpenAI(srv.URL, "gemini-3.1-flash-lite")
	enricher.Logger = slog.New(slog.NewTextHandler(&buf, nil))

	_, err := enricher.Enrich(t.Context(), Request{
		Text:                   "run",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable, got %v", err)
	}
	logged := buf.String()
	if !strings.Contains(logged, "status_code=502") || !strings.Contains(logged, "gemini-3.1-flash-lite") {
		t.Fatalf("expected stdout error log with status_code=502 and model, got %q", logged)
	}
}
```

- [ ] **Step 2: Run `internal/enrich` tests to verify they fail**

Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 -v ./internal/enrich`
Expected: FAIL with `too few arguments in call to NewOpenAI` and `enricher.Logger undefined`.

- [ ] **Step 3: Update `backend/internal/enrich/openai.go` and delete `phrase_route.go` / `phrase_route_test.go`**

1. In `backend/internal/enrich/openai.go`:
   - Update `OpenAIEnricher` struct to have fields `BaseURL string`, `Model string`, `Client *http.Client`, and `Logger *slog.Logger` (removing `APIKey`).
   - Change `NewOpenAI(baseURL, model string) *OpenAIEnricher` to initialize `BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/")`, `Model: strings.TrimSpace(model)`, `Client: &http.Client{Timeout: 30 * time.Second}`, and `Logger: slog.New(slog.NewTextHandler(os.Stdout, nil))`.
   - In `Enrich()` and `Translate()`, check `if e.BaseURL == "" || e.Model == "" { return ..., ErrNotConfigured }`.
   - In `complete()`, remove `httpReq.Header.Set("Authorization", ...)`. When `e.Client.Do(httpReq)` fails or `resp.StatusCode != http.StatusOK`, log via `e.logger().Error("enrich: llm request failed", ...)` (defaulting to `slog.New(slog.NewTextHandler(os.Stdout, nil))` when `e.Logger == nil`) with `"url"`, `"model"`, `"status_code"`, and `"error"`/`"body"`, then return `ErrUnavailable`.
2. Delete `backend/internal/enrich/phrase_route.go` and `backend/internal/enrich/phrase_route_test.go`.

- [ ] **Step 4: Run `internal/enrich` tests to verify they pass**

Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 -v ./internal/enrich`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A backend/internal/enrich
git commit -m "feat(enrich): send only URL and model in OpenAIEnricher and log errors to stdout"
```

---

### Task 3: Wire `WiktApi -> Miss -> LLM` and Stop on Error Across `words`, `http`, and `cmd`

**Files:**
- Modify: `backend/cmd/api/main.go:75-98`
- Modify: `backend/cmd/retranslate-senses/main.go:55-67`
- Modify: `backend/internal/words/service.go:143-156`
- Delete: `backend/internal/words/phrase_draft.go`
- Modify: `backend/internal/words/phrase_draft_test.go`
- Modify: `backend/internal/words/learning_log_test.go:26,106`
- Modify: `backend/internal/words/deck_test.go:51`
- Modify: `backend/internal/http/words_handler.go:301-307`
- Modify: `backend/internal/http/words_handler_test.go:81,524,1308`
- Modify: `backend/internal/http/user_handler_test.go:53`
- Modify: `backend/internal/http/auth_handler_test.go:81`

**Interfaces:**
- Consumes: `NewOpenAI(baseURL, model string)` from Task 2 and `Config.EnrichPrimaryBaseURL` / `Config.EnrichPrimaryModel` from Task 1
- Produces: Updated `words.Service.Lookup` (no `phraseDraftEntry` fallback; logs to stdout and returns error) and updated binary entrypoints (`cmd/api/main.go`, `cmd/retranslate-senses/main.go`)

- [ ] **Step 1: Replace `TestPhraseLookupDraftWhenEnrichFailsThenAddLearningItem` in `backend/internal/words/phrase_draft_test.go` with a test asserting phrase lookup fails when enricher errors**

In `backend/internal/words/phrase_draft_test.go`, replace the draft creation test with:

```go
func TestPhraseLookupFailsWhenEnrichFails(t *testing.T) {
	pool := deckTestPool(t)
	userID, _ := deckTestUser(t, pool)
	ctx := context.Background()

	svc := New(pool, &stubEnricher{enrichErr: enrich.ErrUnavailable}, &fakeLogger{}, learninglog.NoopLogger{}, "", "en", "ko")

	lemma := fmt.Sprintf("look up %d", time.Now().UnixNano())
	pos := "phrase"
	_, err := svc.Lookup(ctx, userID, lemma, "en", "ko", "Please look up the word.", &pos)
	if !errors.Is(err, enrich.ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable when enricher fails on phrase, got %v", err)
	}
}
```

- [ ] **Step 2: Update `words/service.go`, delete `phrase_draft.go`, and update `NewOpenAI` call sites**

1. Delete `backend/internal/words/phrase_draft.go`.
2. In `backend/internal/words/service.go` (`Lookup`, lines 143-156):
   - When `s.enricher.Enrich(...)` returns `err != nil`, log to stdout (`slog.New(slog.NewTextHandler(os.Stdout, nil)).Error("enrich lookup failed", "word", normalized, "error", err)`) in addition to `s.logf("ENRICH_FAIL", ...)` and return `LookupResult{}, err` immediately.
3. In `backend/cmd/api/main.go` and `backend/cmd/retranslate-senses/main.go`:
   - Check `if cfg.EnrichPrimaryBaseURL != ""` (instead of `cfg.EnrichPrimaryAPIKey != ""`).
   - Construct `llm := enrich.NewOpenAI(cfg.EnrichPrimaryBaseURL, cfg.EnrichPrimaryModel)` and wire `enricher = enrich.NewFallback(primaryEnricher, llm, slog.New(slog.NewTextHandler(os.Stdout, nil)))` so **WiktApi runs first, and on miss calls the LLM**.
4. In `backend/internal/http/words_handler.go`:
   - Update the `ADD-402` message on line 302 to reference `ENRICH_PRIMARY_BASE_URL` instead of `ENRICH_PRIMARY_API_KEY`.
5. Update `enrich.NewOpenAI("", "", "")` in test files (`learning_log_test.go`, `deck_test.go`, `words_handler_test.go`, `user_handler_test.go`, `auth_handler_test.go`) to `enrich.NewOpenAI("", "")`.

- [ ] **Step 3: Run the full backend test suite serially to verify all packages pass**

Run: `cd backend && set -a && source .env && set +a && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`
Expected: PASS across all Go packages.

- [ ] **Step 4: Commit**

```bash
git add -A backend/cmd backend/internal/words backend/internal/http
git commit -m "feat(words): route WiktApi first then LLM and stop with stdout log on error"
```

---

### Task 4: Update `NetworkPolicy` and Operator Documentation

**Files:**
- Modify: `deploy/projects/pn/boundary/network-policy.yaml:44-64`
- Modify: `backend/docs/cursor-secrets.md:14-43,115-129`
- Modify: `backend/docs/oracle-deploy-runbook.md:93-125`
- Modify: `backend/docs/go-backend-setup.md:165-205`
- Modify: `backend/docs/backend-overview.md:112-123`

**Interfaces:**
- Consumes: `ENRICH_PRIMARY_BASE_URL` and `ENRICH_PRIMARY_MODEL` from Task 1
- Produces: Updated `NetworkPolicy` and operator documentation

- [ ] **Step 1: Update `deploy/projects/pn/boundary/network-policy.yaml` and `backend/docs/*.md`**

1. In `deploy/projects/pn/boundary/network-policy.yaml`:
   - Add TCP port `8080` under the `vault` namespace egress rule (for the in-cluster AI service) alongside `5432`.
   - Add rule `# 4. Public HTTPS egress for WiktApi gloss lookup` permitting TCP `443` to `0.0.0.0/0` `except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]`.
2. In `backend/docs/cursor-secrets.md`, `backend/docs/oracle-deploy-runbook.md`, `backend/docs/go-backend-setup.md`, and `backend/docs/backend-overview.md`:
   - Remove `ENRICH_PRIMARY_API_KEY` and `ENRICH_FALLBACK_*`.
   - Document that `Project_PN` only sends requests to `ENRICH_PRIMARY_BASE_URL` with `ENRICH_PRIMARY_MODEL` when WiktApi misses (`WiktApi first => miss => LLM`), while OpenBao in the Kubernetes cluster manages the upstream AI API credential. When `ENRICH_PRIMARY_BASE_URL` is unset, `Project_PN` runs WiktApi-only.

- [ ] **Step 2: Verify the updated documentation and manifest**

Run: `! grep -n "ENRICH_FALLBACK\|ENRICH_PRIMARY_API_KEY" backend/docs/cursor-secrets.md backend/docs/go-backend-setup.md backend/docs/backend-overview.md && grep -n "ENRICH_PRIMARY_BASE_URL" backend/docs/cursor-secrets.md backend/docs/go-backend-setup.md`
Expected: Zero matches for `ENRICH_FALLBACK` or `ENRICH_PRIMARY_API_KEY` in the updated docs, and matches for `ENRICH_PRIMARY_BASE_URL`.

- [ ] **Step 3: Commit**

```bash
git add deploy/projects/pn/boundary/network-policy.yaml backend/docs/cursor-secrets.md backend/docs/oracle-deploy-runbook.md backend/docs/go-backend-setup.md backend/docs/backend-overview.md
git commit -m "docs(backend): update docs and NetworkPolicy for URL+model only LLM enrichment"
```
