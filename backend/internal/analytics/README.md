# Analytics

## Overview
Owns the versioned, append-only product analytics event schema, validation rules, credential-scrubbing guardrails, and non-throwing JSON stdout event emitter for forwarding to the platform analytics sink.

## Interface
- `CurrentEventVersion` (`1`) `[events.go:CurrentEventVersion]`
- `Event`, `Batch`, `Record` `[events.go:Event]`, `[events.go:Batch]`, `[events.go:Record]`
- `NewRecord(event Event, now time.Time) Record`, `Validate(event Event) error`, `NewID() string`, `NewServerRecord(name, traceID string, properties map[string]any) Record` `[events.go:NewRecord]`, `[events.go:Validate]`, `[events.go:NewID]`, `[events.go:NewServerRecord]`
- `Logger`, `NoopLogger`, `JSONLogger`, `NewJSONLogger(out io.Writer) *JSONLogger`, `(*JSONLogger).Emit(record Record)` `[logger.go:Logger]`, `[logger.go:NoopLogger]`, `[logger.go:JSONLogger]`, `[logger.go:NewJSONLogger]`, `[logger.go:Emit]`

## Invariants
- `Validate` requires `event_name` to be in `allowedEventNames`, `event_version == CurrentEventVersion` (`1`), RFC 3339 `occurred_at`, non-empty `app_version` (`<= 128` bytes), `platform` in `{web, ios, android, tauri, extension, backend}`, non-nil `properties`, and UUID-formatted `event_id`, `session_id`, `anonymous_id`, and `trace_id` (allowing 32 lowercase hex characters for `trace_id`) `[events.go:Validate]`, `[events.go:allowedEventNames]`.
- `Validate` rejects nested `properties` maps/slices containing forbidden credential keys (`token`, `access_token`, `refresh_token`, `id_token`, `password`, `secret`, `authorization`, `cookie`, `set_cookie`, matched case-insensitively with `-` normalized to `_`) `[events.go:hasForbiddenProperty]`.
- `NewServerRecord` replaces invalid/non-UUID `traceID` values with a freshly generated v4 UUID `[events.go:NewServerRecord]`.
- `(*JSONLogger).Emit` recovers from panics, populates missing `Time`/`Category` envelope fields via `NewRecord`, and strips hyphens/lowercases `TraceID` before encoding `[logger.go:Emit]`.

## Side Effects
- Reads OS cryptographic entropy via `crypto/rand.Read` when generating v4 UUIDs in `NewID` `[events.go:NewID]`.
- Reads process-wide service metadata via `logx.Service()` and `logx.Version()` `[events.go:NewRecord]`.
- Serializes and writes JSON lines to `os.Stdout` (default when `out == nil`) or the configured `io.Writer` under `JSONLogger.mu` `[logger.go:NewJSONLogger]`, `[logger.go:Emit]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/analytics` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
