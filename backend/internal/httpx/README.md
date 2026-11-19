# HTTPX

## Overview
Provides W3C `traceparent` parsing, random 32-hex trace ID generation, request-scoped `*slog.Logger` context storage, and HTTP access-logging middleware conforming to Contract v3 structured log attributes.

## Interface
- `WithLogger(ctx context.Context, logger *slog.Logger) context.Context` `[trace.go:WithLogger]`
- `LoggerFromContext(ctx context.Context) *slog.Logger` `[trace.go:LoggerFromContext]`
- `TraceIDFromContext(ctx context.Context) string` `[trace.go:TraceIDFromContext]`
- `ParseTraceparent(header string) (string, bool)` `[trace.go:ParseTraceparent]`
- `NewTraceID() string` `[trace.go:NewTraceID]`
- `Middleware(baseLogger *slog.Logger) func(http.Handler) http.Handler` `[trace.go:Middleware]`

## Invariants
- `ParseTraceparent` accepts only W3C traceparent headers with 2-hex version (`!= "ff"`), non-zero 32-hex `trace_id`, 16-hex `parent_id`, and 2-hex `flags` (case-normalized to lowercase) `[trace.go:ParseTraceparent]`.
- `NewTraceID` never returns the all-zero 32-hex trace ID (`00000000000000000000000000000000`) `[trace.go:NewTraceID]`.
- `LoggerFromContext` returns the context logger if present, otherwise `slog.Default()` enriched with `trace_id` when present in `ctx` `[trace.go:LoggerFromContext]`.
- `statusRecorder` captures only the first status code (defaulting to `200 OK` on implicit `Write`), delegates `Flush()` when supported, and exposes `Unwrap()` for `http.ResponseController` compatibility `[trace.go:statusRecorder]`, `[trace.go:WriteHeader]`, `[trace.go:Write]`, `[trace.go:Flush]`, `[trace.go:Unwrap]`.

## Side Effects
- Reads cryptographic randomness from `crypto/rand.Read` in `NewTraceID` `[trace.go:NewTraceID]`.
- Emits one structured access log line per HTTP request via `reqLogger.ErrorContext` (for status `>= 500`) or `reqLogger.InfoContext` (otherwise) with `trace_id`, `http.request.method`, `url.path`, `http.response.status_code`, and `http.server.request.duration` `[trace.go:Middleware]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/httpx` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
