# Admin Logging Design

**Amended 2026-10-24.** The file path `/var/log/project-pn/admin.log` and `ADMIN_LOG_PATH` are withdrawn. Production is k3s. An in-container file is invisible to `kubectl logs` and is lost on restart. Admin audit is one JSON line per event on stderr. Do not write that stream to a file, and do not print it on stdout.

## Overview

The Go backend emits admin audit events on stderr. containerd saves that stream. The platform collector reads the node capture. No dashboard UI, no PostgreSQL tables, and no admin API endpoints are added in this contract.

## Goals

- Emit one JSON audit line per event on stderr, with `event.name:"admin"` and Contract v3 required fields (`time`, `level`, `msg`, `service.name`, `service.version`).
- Keep handler call sites on `admin.Logger`. A write failure must not fail the HTTP request.
- Do not close process stderr. `Close()` is a no-op.
- Keep analytics on stdout. Admin must not share that stream.

## Non-Goals

- An in-container log file, `logrotate`, or `ADMIN_LOG_PATH`.
- Pointing a file logger at `/dev/stdout` or `/dev/stderr`. Closing that writer would close the process stream.
- Mixing admin lines into the analytics stdout stream.
- Shipping learning daily files. Those stay files and are not this stream.
- A dashboard UI, PostgreSQL log tables, or an admin log API.

## Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Storage | stderr | The kubelet already rotates stdout and stderr. A container file does not survive restart. |
| Format | One JSON object per line: `time`, `level`, `msg`, `service.name`, `service.version`, `event.name`, `category` | `event.name:"admin"` keeps this stream distinct from `event.name:"analytics"` under Platform Log Contract v3. |
| Stdout | Analytics only | The analytics contract excludes admin lines from that stream. |
| Dashboard | None in this repo | Operator reads history through the platform log store. |
| DB / API impact | None | No new tables or endpoints. |

## Architecture

```text
project prints admin JSON to stderr
 → containerd writes /var/log/pods/proj-pn_.../<container>/0.log
 → platform collector stores the line
 → operator reads it by project, time, and container
```

The app does not open `/var/log/pods` and does not create `/var/log/project-pn/admin.log`.

## Line format

```json
{"time":"2026-10-24T00:00:00.000Z","level":"info","msg":"...","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"AUTH"}
```

- `event.name` is always `admin` (replaces legacy `kind`).
- `time` is RFC 3339 UTC with millisecond precision.
- `level` is `info`.
- `service.name` is `pn-api` and `service.version` is the build version (`v<semver>` or `v0.0.0-<commit>`).
- `category` is the existing tag (`AUTH`, `METRICS`, `ERROR`, and the others below).
- `msg` is the existing one-sentence description. Do not add tokens, passwords, or secrets.
- Emails and IPs may already be in `msg`. This stream is operator-only. Do not put these lines on the analytics stdout.

## Event Categories

| Category | Description | Example |
|----------|-------------|---------|
| `AUTH` | Confirmed authenticated identity or successful logout. | `{"time":"2026-07-07T13:16:30.000Z","level":"info","msg":"user@example.com identity confirmed from 192.168.1.1","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"AUTH"}` |
| `AUTH_FAILURE` | Failed authentication or invalid session. | `{"time":"2026-07-07T13:16:31.000Z","level":"info","msg":"login failed for unknown@example.com from 192.168.1.2: session invalid","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"AUTH_FAILURE"}` |
| `VERIFY_REQUIRED` | Unverified user attempted a protected route. | `{"time":"2026-07-07T13:16:35.000Z","level":"info","msg":"user@example.com requested POST /api/learning-items but email is not verified","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"VERIFY_REQUIRED"}` |
| `ADD_WORD` | New global word created (cache miss or manual). | `{"time":"2026-07-07T13:16:40.000Z","level":"info","msg":"user 550e8400-e29b-41d4-a716-446655440000 created word 'analyze' (en, verb)","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"ADD_WORD"}` |
| `ADD_ITEM` | User added a learning item. | `{"time":"2026-07-07T13:16:45.000Z","level":"info","msg":"user@example.com added learning item word_sense_id=abc123","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"ADD_ITEM"}` |
| `DECK_CREATED` | User created a deck. | `{"time":"2026-07-07T13:16:50.000Z","level":"info","msg":"user@example.com created deck 'Korean Core' (ko)","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"DECK_CREATED"}` |
| `METRICS` | Periodic server status summary. | `{"time":"2026-07-07T13:17:00.000Z","level":"info","msg":"last 60s: 45 requests, 2 errors, avg latency 42ms, 12 active users","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"METRICS"}` |
| `ERROR` | Unexpected internal error. | `{"time":"2026-07-07T13:17:05.000Z","level":"info","msg":"failed to connect to enrichment provider: timeout","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"ERROR"}` |
| `ENRICH_FAIL` | Enrichment request failed. | `{"time":"2026-07-07T13:17:06.000Z","level":"info","msg":"enricher failed for word 'obscureterm': timeout","service.name":"pn-api","service.version":"v1.4.2","event.name":"admin","category":"ENRICH_FAIL"}` |

## Components

### `backend/internal/admin/logger.go`

- `Logger` is `Log`, `Logf`, and `Close`.
- `NewLogger` writes JSON lines to stderr. It does not open a file.
- `Close` does not close stderr.
- A write error is logged with `slog` and does not fail the caller.

### `backend/internal/admin/middleware.go`

- `HTTPLoggingMiddleware` records request timing, updates in-memory counters, and emits `ERROR` for handler 5xx responses.
- It does not emit `AUTH` or `AUTH_FAILURE`. Those come from the auth call sites below.
- `requireVerified` emits `VERIFY_REQUIRED`.
- In-memory counters feed the periodic `METRICS` line.

### Background metrics goroutine

- Every 60 seconds, emit one `METRICS` line and reset the counters.

### Call sites

| Handler / middleware | Category |
|----------------------|----------|
| `authMiddleware` (invalid session) | `AUTH_FAILURE` |
| `GET /api/auth/me` (valid session) | `AUTH` |
| `POST /api/auth/logout` (successful) | `AUTH` |
| `requireVerified` | `VERIFY_REQUIRED` |
| Add-word / lookup handler (cache miss path) | `ADD_WORD` |
| Add-learning-item handler | `ADD_ITEM` |
| Deck handler (create) | `DECK_CREATED` |
| Enricher error path | `ENRICH_FAIL` |
| Handler-level 5xx responses | `ERROR` |

## Configuration

There is no `ADMIN_LOG_PATH`. Admin audit is always stderr. Learning daily files still use `LEARNING_LOG_DIR` and are not this stream.

## Error Handling

- If the stderr write fails, the original HTTP request must still succeed.
- The write failure is reported with `slog`.
- `Close` must not close process stderr or stdout.
- A panic in the logger must not reach the request handler.

## Security and Privacy

- `msg` may contain an email or an IP. The platform store is operator-only. Do not publish this stream.
- Do not add tokens, passwords, secrets, or personal notes.
- Do not print these lines on the analytics stdout.

## Testing

- A unit test checks `event.name`, `category`, `time`, `level`, `msg`, `service.name`, `service.version`, and concurrent writes.
- `Close` does not close the test writer.
- A logger write failure does not fail the request.

## Migration Impact

No database migration. Remove `ADMIN_LOG_PATH` from environments. An existing `/var/log/project-pn/admin.log` inside a container is abandoned.

## Future Considerations

- An analytics-only sink may filter `event.name == "analytics"`. This admin stream stays `event.name:"admin"` on stderr.
- Learning daily files stay files unless those events are also printed.
- Email and IP redaction, if added, belongs in the collector, not in a second file.
