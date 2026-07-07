# Admin Logging Design

## Overview

Add a lightweight, file-only admin logging subsystem to the Project PN Go backend. The logs are plain-text, one-line events intended to be ingested by an external "main auth system" dashboard. No dashboard UI, no PostgreSQL tables, and no admin API endpoints are added to Project PN in this MVP.

## Goals

- Emit human-readable audit and status logs from the Go backend.
- Keep the implementation minimal: one log file, one logger helper, a middleware, and a few call sites.
- Do not affect existing database schema or API contracts.
- Allow an external system to tail or parse the log file for dashboards.

## Non-Goals

- Build a custom dashboard UI inside Project PN.
- Store logs in PostgreSQL or any other database.
- Provide structured JSON logs.
- Add real-time streaming, log rotation, or long-term archival (handled externally).
- Add configuration options beyond a single file path environment variable.

## Context

Project PN is a vocabulary-learning app with a Go backend and a React Native/Expo frontend. Authentication is delegated to an external Nacfson Cloud central auth service. The backend currently enforces email verification only on learning routes when `REQUIRE_EMAIL_VERIFIED=true`. Because unverified or "dumb" emails can sign in and access non-learning endpoints, operator visibility into auth events and verification failures is important.

## Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Storage | Plain-text file | Cheapest MVP option; external dashboard ingests it. |
| Format | Human-readable one-line sentences | Explicitly requested; easy to read with `tail`/`grep`. |
| Dashboard location | None in this repo | External "main auth system" owns the dashboard. |
| DB impact | None | No new tables or schema changes. |
| API impact | None | No new admin endpoints. |
| Configuration | Single env var only | Keep scope minimal. |

## Architecture

```text
+---------------+        +-------------------------+        +-------------------+
| Project PN Go | -----> | /var/log/project-pn/    | -----> | External main     |
| backend       | writes | admin.log (plain text)  | ingests| auth dashboard      |
+---------------+        +-------------------------+        +-------------------+
```

The backend writes events synchronously to a log file. Existing HTTP middleware and business handlers call a small `admin.Logger` helper. A background goroutine emits a `[METRICS]` summary line every 60 seconds.

## Log File

- **Path**: configurable via `ADMIN_LOG_PATH` environment variable; default `/var/log/project-pn/admin.log`.
- **Format**: one line per event, UTF-8 text.
- **Rotation**: not handled by the application; use `logrotate` or systemd journal rules.
- **Retention**: not handled by the application; use external Linux log retention.

## Log Line Format

```text
<TIMESTAMP> [<CATEGORY>] <one-sentence description>
```

- `TIMESTAMP`: RFC 3339 UTC, e.g. `2026-07-07T13:16:30Z`.
- `CATEGORY`: uppercase bracketed tag, e.g. `[AUTH]`, `[METRICS]`.
- Description: short human-readable sentence with relevant identifiers.

## Event Categories

| Category | Description | Example |
|----------|-------------|---------|
| `AUTH` | Confirmed authenticated identity or successful logout. | `2026-07-07T13:16:30Z [AUTH] user@example.com identity confirmed from 192.168.1.1` |
| `AUTH_FAILURE` | Failed authentication or invalid session. | `2026-07-07T13:16:31Z [AUTH_FAILURE] login failed for unknown@example.com from 192.168.1.2: session invalid` |
| `VERIFY_REQUIRED` | Unverified user attempted a protected route. | `2026-07-07T13:16:35Z [VERIFY_REQUIRED] user@example.com requested POST /api/learning-items but email is not verified` |
| `ADD_WORD` | New global word created (cache miss or manual). | `2026-07-07T13:16:40Z [ADD_WORD] user 550e8400-e29b-41d4-a716-446655440000 created word 'analyze' (en, verb)` |
| `ADD_ITEM` | User added a learning item. | `2026-07-07T13:16:45Z [ADD_ITEM] user@example.com added learning item word_sense_id=abc123` |
| `DECK_CREATED` | User created a deck. | `2026-07-07T13:16:50Z [DECK_CREATED] user@example.com created deck 'Korean Core' (ko)` |
| `METRICS` | Periodic server status summary. | `2026-07-07T13:17:00Z [METRICS] last 60s: 45 requests, 2 errors, avg latency 42ms, 12 active users` |
| `ERROR` | Unexpected internal error. | `2026-07-07T13:17:05Z [ERROR] failed to connect to enrichment provider: timeout` |
| `ENRICH_FAIL` | Enrichment request failed. | `2026-07-07T13:17:06Z [ENRICH_FAIL] enricher failed for word 'obscureterm': timeout` |

## Components

### `backend/internal/admin/logger.go`

- Defines `Logger` interface:
  - `Log(category string, message string)`
  - `Logf(category string, format string, args ...interface{})`
  - `Close() error`
- Implements a `FileLogger` that opens `ADMIN_LOG_PATH` for append.
- Creates the log directory if it does not exist.
- Writes lines with a mutex so concurrent callers are safe.

### `backend/internal/admin/middleware.go`

- `HTTPLoggingMiddleware`:
  - Records request start time.
  - Writes `[AUTH_FAILURE]` when session validation fails in `authMiddleware`.
  - Writes `[AUTH]` on successful `GET /api/auth/me` and `POST /api/auth/logout`.
  - Writes an `[ERROR]` line for 5xx responses.
  - Updates in-memory counters for the periodic `[METRICS]` line.
- `VerificationLoggingMiddleware` (or embedded in existing `requireVerified`):
  - Writes `[VERIFY_REQUIRED]` when an unverified user is rejected.

### Background metrics goroutine

- Started in `main` or server initialization if logger is enabled.
- Every 60 seconds, reads in-memory counters and writes one `[METRICS]` line.
- Resets counters after each emission.

### Call sites

| Handler / middleware | Event logged |
|----------------------|--------------|
| `authMiddleware` (invalid session) | `AUTH_FAILURE` |
| `GET /api/auth/me` (valid session) | `AUTH` (login identity confirmed) |
| `POST /api/auth/logout` (successful) | `AUTH` |
| `requireVerified` middleware | `VERIFY_REQUIRED` |
| Add-word / lookup handler (cache miss path) | `ADD_WORD` |
| Add-learning-item handler | `ADD_ITEM` |
| Deck handler (create) | `DECK_CREATED` |
| Enricher error path | `ENRICH_FAIL` |
| Handler-level 5xx responses | `ERROR` |

## Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `ADMIN_LOG_PATH` | `/var/log/project-pn/admin.log` | Absolute path to the admin log file. If empty, admin logging is disabled. |

No other configuration options are exposed in the MVP.

## Error Handling

- If the admin log file cannot be written, the original HTTP request must still succeed.
- The write failure is written to stderr so operators can detect it.
- If the log directory cannot be created on startup, the logger is disabled and a warning is printed; the server continues.
- Panics in the logger must not propagate to request handlers.

## Security and Privacy

- Log lines include email addresses and IP addresses. Ensure the log file has restrictive permissions (`0640` or tighter).
- Do not log sensitive data such as passwords, tokens, or personal notes.
- The file path should be outside the web root and not served by the API.

## Testing

- Unit test for `FileLogger` verifying line format and concurrent safety.
- Middleware test verifying an HTTP request produces the expected log line.
- Handler test verifying add-word flow emits `[ADD_WORD]`.
- Test that logger failure does not fail the request.

## Migration Impact

None. No database migrations are added.

## Future Considerations

- If log volume grows, the external system may prefer structured output (JSON). This can be added as an optional format later without changing handler call sites.
- If real-time dashboarding is needed, a small `/admin/logs/stream` endpoint could be added, but that is out of MVP scope.
- Log rotation could be moved into the application if external `logrotate` is unavailable.
