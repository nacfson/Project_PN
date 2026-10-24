# Log Stream Alignment Plan

> Implemented 2026-10-24. Do not re-execute. Persistent logs are stderr admin JSON and stdout analytics JSON. `LEARNING_LOG_DIR` stays empty.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistent logs are the process streams. Admin audit is one `kind:"admin"` JSON line on stderr. Behavioral analytics is one `kind:"analytics"` JSON line on stdout. No local dump is required.

**Architecture:** The platform collector reads every `proj-*` stdout and stderr line and is the store. This repo does not add a kind filter, a log file, or a required `LEARNING_LOG_DIR`. The learning-file writer already no-ops when that variable is empty. Leave it off. Do not print learning rows, and do not delete the package in this plan.

**Tech Stack:** Go 1.26, existing `internal/admin` and `internal/analytics`. No new tables, routes, or frontend changes.

## What is stored

| What | Where | Required |
|------|--------|----------|
| Admin audit | stderr, `kind:"admin"` | yes |
| Behavioral analytics | stdout, `kind:"analytics"`, only when `ANALYTICS_ENABLED=true` | yes, when enabled |
| Ordinary `slog` lines | stderr | already there; collector keeps them |
| Learning daily files | `{LEARNING_LOG_DIR}/YYYYMMDD_log` | no |

The backend does not read learning files. Postgres already holds review state. The July file export is not part of this configuration. Empty `LEARNING_LOG_DIR` is the configured state.

Analytics stdout is not a substitute for that old export. `card_rated` and `review_succeeded` do not carry gloss text or FSRS difficulty and stability. This plan does not add those fields and does not print learning rows to fill the gap.

## Sources

1. `docs/superpowers/specs/2026-07-07-admin-logging-design.md` (amended 2026-10-24)
2. `docs/analytics-contract.md`

`docs/superpowers/plans/2026-07-07-admin-logging-plan.md` is superseded. Do not implement its file path.

`docs/superpowers/specs/2026-07-27-learning-daily-log-design.md` describes an optional export. Do not re-execute it. Do not treat it as a required sink.

## Starting point

The working tree already moved admin off the file. Keep that diff. Do not revert it.

Already applied, uncommitted:

- `admin.NewLogger()` writes JSON to `os.Stderr`. `Close` is a no-op. No file open.
- `Config.AdminLogPath` and `ADMIN_LOG_PATH` are gone from config and both `cmd` entrypoints.
- `backend/.env.example` no longer sets an admin file path.
- `backend/docs/go-backend-setup.md` describes stderr admin JSON.

Still wrong:

- The superseded admin plan body is still an executable file-logger recipe.
- The learning plan and design still talk as if `admin.log` and a required learning dump are part of the log architecture.
- The admin design says `HTTPLoggingMiddleware` emits `AUTH` and `AUTH_FAILURE`. Call sites do that. The middleware emits `ERROR` and metrics only. Do not add a second auth log.
- `streamLogger.Log` does not recover a panic. The design says a logger panic must not reach the handler.
- Tests do not prove `Close` leaves the writer open, or that a write error leaves the HTTP status alone.
- `backend/.env.example` and `backend/internal/analytics/events.go` still describe a Vector filter that keeps only `kind == "analytics"`. That profile is not the current collector.

## Global constraints

- Do not reintroduce `ADMIN_LOG_PATH`, `/var/log/project-pn/admin.log`, or `admin.FileLogger`.
- Do not point a file logger at `/dev/stdout` or `/dev/stderr`.
- Do not print admin lines on stdout.
- Do not print learning rows on stdout or stderr.
- Do not set `LEARNING_LOG_DIR` in env examples, deploy docs, or manifests.
- Do not delete `internal/learninglog` or its call sites in this plan.
- Do not move `slog` to stdout.
- Do not add a producer-side kind filter.
- Do not add PostgreSQL tables, admin APIs, or frontend UI.
- Logger failures and logger panics must not change the HTTP status.
- `Close` must not close stderr, stdout, or the injected writer.
- No tokens, passwords, secrets, or personal notes in admin `message`.

## File map

| File | Change |
|------|--------|
| `docs/superpowers/plans/2026-07-07-admin-logging-plan.md` | Replace the body with a superseded stub. |
| `docs/superpowers/plans/2026-07-27-learning-daily-log.md` | Banner: optional export, not a required sink. Do not re-execute. |
| `docs/superpowers/specs/2026-07-27-learning-daily-log-design.md` | Say the file is optional and off by default. Remove `admin.log` wording. |
| `docs/superpowers/specs/2026-07-07-admin-logging-design.md` | Fix the middleware bullet and the prose category examples. |
| `backend/internal/admin/logger.go` | Recover panics inside `Log`. |
| `backend/internal/admin/logger_test.go` | Close-does-not-close and write-failure tests. |
| `backend/internal/admin/middleware_test.go` | Failing or panicking logger does not change handler status. |
| `backend/.env.example` | Collector reads every stdout and stderr line. `LEARNING_LOG_DIR` stays empty. |
| `backend/internal/analytics/events.go` | Drop the Vector-filter comment. |
| `backend/cmd/api/main.go` | Delete the dead `NoopLogger` metrics guard. |

---

### Task 1: Retire the executable file-path plan

**Files:**

- Modify: `docs/superpowers/plans/2026-07-07-admin-logging-plan.md`

- [ ] **Step 1: Replace the file body**

Keep the filename. Replace the body. Do not leave the old tasks or code samples.

```markdown
# Admin Logging Implementation Plan

> Superseded 2026-10-24. Do not implement this file.

Admin audit is one `kind:"admin"` JSON line on stderr. There is no admin log file and no `ADMIN_LOG_PATH`.

Live contract: `docs/superpowers/specs/2026-07-07-admin-logging-design.md`.

Alignment plan: `docs/superpowers/plans/2026-10-24-log-stream-alignment.md`.

Persistent logs are stdout and stderr only. Do not add a local dump.
```

- [ ] **Step 2: Confirm the old recipe is gone**

```bash
rg -n "ADMIN_LOG_PATH|FileLogger|defaultAdminLogPath" docs/superpowers/plans/2026-07-07-admin-logging-plan.md
```

Expected: no matches.

---

### Task 2: Mark the learning file as not required

**Files:**

- Modify: `docs/superpowers/plans/2026-07-27-learning-daily-log.md`
- Modify: `docs/superpowers/specs/2026-07-27-learning-daily-log-design.md`

- [ ] **Step 1: Banner the old learning plan**

Under the title:

```markdown
> Optional export. Not part of the persistent log architecture. Do not re-execute. Leave `LEARNING_LOG_DIR` empty. Do not print these rows on stdout or stderr. Admin audit is stderr JSON, not `admin.log`.
```

Replace the constraint `Separate from admin.log; do not change admin log format.` with: separate from admin stderr JSON and analytics stdout; do not print learning rows; do not change those streams.

In Task 10, replace `note separate from ADMIN_LOG_PATH` with `note that this file is optional and off by default`.

- [ ] **Step 2: Amend the learning design overview**

Add under the title:

```markdown
> Amended 2026-10-24. This file export is not required. Persistent logs are stdout and stderr. Leave `LEARNING_LOG_DIR` empty unless an operator explicitly wants a local copy. The API must not read these files.
```

Replace leftover `admin.log`, `ADMIN_LOG_PATH`, and `admin.FileLogger` wording with: admin audit is stderr JSON; this writer is a separate optional directory; do not print these rows.

Do not change the row format or event catalog.

- [ ] **Step 3: Search**

```bash
rg -n "admin\.log|ADMIN_LOG_PATH|admin\.FileLogger" docs/superpowers/specs/2026-07-27-learning-daily-log-design.md docs/superpowers/plans/2026-07-27-learning-daily-log.md
```

Expected: no matches.

---

### Task 3: Correct the admin design so it matches call sites

**Files:**

- Modify: `docs/superpowers/specs/2026-07-07-admin-logging-design.md`

- [ ] **Step 1: Fix the middleware bullets**

```markdown
- `HTTPLoggingMiddleware` records request timing, updates in-memory counters, and emits `ERROR` for handler 5xx responses.
- It does not emit `AUTH` or `AUTH_FAILURE`. Those come from the auth call sites below.
- `requireVerified` emits `VERIFY_REQUIRED`.
- In-memory counters feed the periodic `METRICS` line.
```

- [ ] **Step 2: Make category examples JSON**

Replace each prose example `2026-07-07T13:16:30Z [AUTH] ...` with one JSON object: `kind:"admin"`, the category, an RFC3339 `time`, and the existing message text. Do not change the message text.

- [ ] **Step 3: Do not move auth logs**

Do not edit auth handlers to satisfy the old bullet.

---

### Task 4: Recover admin logger panics and prove Close and write failure

**Files:**

- Modify: `backend/internal/admin/logger.go`
- Modify: `backend/internal/admin/logger_test.go`
- Modify: `backend/internal/admin/middleware_test.go`

- [ ] **Step 1: Write the tests**

In `logger_test.go`:

1. `closeProbe` implements `io.Writer` and `io.Closer`. `Close` sets `closed = true`.
2. `TestStreamLogger_CloseDoesNotCloseWriter`: after `Close`, `closed` is false, and a later `Log` still writes `kind:"admin"`.
3. `TestStreamLogger_WriteErrorDoesNotPanic`: a writer that returns an error; `Log` returns.
4. `TestStreamLogger_WritePanicIsRecovered`: a writer that panics; `Log` returns.

In `middleware_test.go`, `TestHTTPLoggingMiddleware_LoggerFailureKeepsStatus`: handler writes `204`; middleware uses a failing writer, then a panicking writer; both responses stay `204`.

- [ ] **Step 2: Run and confirm the panic test fails first**

```bash
cd backend && go test ./internal/admin -run 'TestStreamLogger_CloseDoesNotCloseWriter|TestStreamLogger_WriteErrorDoesNotPanic|TestStreamLogger_WritePanicIsRecovered|TestHTTPLoggingMiddleware_LoggerFailureKeepsStatus' -count=1
```

Expected: FAIL on the panic test until Step 3. Close and write-error may already pass. Keep them.

- [ ] **Step 3: Recover inside `Log`**

Recover before the mutex is held across the write, so a panic still unlocks. Report it with `slog.Error`. Do not close `l.w`. Do not change the JSON fields.

- [ ] **Step 4: Run the admin package**

```bash
cd backend && go test ./internal/admin -count=1
```

Expected: PASS.

---

### Task 5: Remove the Vector-only collector comments

**Files:**

- Modify: `backend/.env.example`
- Modify: `backend/internal/analytics/events.go`

- [ ] **Step 1: Replace the analytics env comment**

```text
# Structured behavioral analytics. Disabled locally by default. When true, the
# API writes one kind:"analytics" JSON line per event to stdout. The platform
# collector reads every proj-* stdout and stderr line. It does not keep only
# that kind. Admin audit is stderr JSON. LEARNING_LOG_DIR stays empty; no local
# dump is required.
ANALYTICS_ENABLED=false
```

Leave `LEARNING_LOG_DIR=` empty. Do not give it a path.

- [ ] **Step 2: Replace the Record comment**

One stdout JSON line. `kind` is `analytics`. The collector also reads other stdout and stderr lines. This producer does not filter them.

- [ ] **Step 3: Search**

```bash
rg -n "Vector analytics filter|retains records only when" backend docs
```

Expected: no producer doc tells the collector to drop non-analytics lines. `docs/analytics-contract.md` may still say a future analytics-only sink may filter. Leave that sentence.

---

### Task 6: Delete the dead metrics guard

**Files:**

- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Always start the 60s flush**

`admin.NewLogger()` never returns `NoopLogger`. Remove that type assert. Keep the ticker, the cancel, and `Flush`. Do not write the metrics line to stdout. Do not flush learning files.

- [ ] **Step 2: Build**

```bash
cd backend && go build ./cmd/api ./cmd/retranslate-senses
```

Expected: PASS.

---

### Task 7: Verify

- [ ] **Step 1: Package tests**

```bash
cd backend && go test ./internal/admin ./internal/analytics ./internal/config -count=1
```

Expected: PASS. No Postgres.

- [ ] **Step 2: Stream search**

```bash
rg -n "ADMIN_LOG_PATH|/var/log/project-pn/admin.log" backend docs --glob '!docs/superpowers/plans/2026-10-24-log-stream-alignment.md'
```

Expected: no live config or spec sets that path. The superseded stub may name it only to forbid it.

```bash
rg -n "os\.Stdout|os\.Stderr" backend/internal/admin backend/internal/analytics backend/cmd/api/main.go
```

Expected: admin uses stderr only; analytics defaults to stdout only; `main` passes stdout only to the analytics logger.

```bash
rg -n "^LEARNING_LOG_DIR=.+" backend/.env.example backend/docs
```

Expected: no non-empty `LEARNING_LOG_DIR` assignment.

---

## Out of scope

- Deleting `internal/learninglog` or its call sites.
- Printing learning rows so the collector stores gloss text or FSRS fields.
- Setting or mounting `LEARNING_LOG_DIR` in production.
- Redacting email or IP in admin messages.
- Changing analytics event names or properties.
- A collector config change in another repository.

## Coverage

| Requirement | Task |
|-------------|------|
| Persistent store is stdout and stderr | Tasks 1, 5, 7 |
| Admin is stderr JSON, no file | already applied; Tasks 1, 4, 7 |
| Analytics is stdout JSON, no kind filter here | Task 5 |
| Learning file dump is not required | Task 2, 5, 7 |
| `Close` does not close the writer | Task 4 |
| Write failure does not fail the request | Task 4 |
| Logger panic does not reach the handler | Task 4 |
| No DB, API, or frontend change | all tasks |
