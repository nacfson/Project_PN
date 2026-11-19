# Admin

## Overview
Provides structured JSON admin audit logging, rolling in-memory HTTP request metrics collection, and Chi-compatible HTTP middleware for observing request latencies, active users, and 5xx errors.

## Interface
- `Logger`, `NoopLogger`, `NewLogger()`, `NewWriterLogger(w io.Writer) Logger` `[logger.go:Logger]`, `[logger.go:NoopLogger]`, `[logger.go:NewLogger]`, `[logger.go:NewWriterLogger]`
- `MetricsCollector`, `NewMetricsCollector()`, `(*MetricsCollector).RecordRequest(statusCode int, latencyMs int64, userID string)`, `(*MetricsCollector).Flush(logger Logger)` `[metrics.go:MetricsCollector]`, `[metrics.go:NewMetricsCollector]`, `[metrics.go:RecordRequest]`, `[metrics.go:Flush]`
- `HTTPLoggingMiddleware(logger Logger, collector *MetricsCollector, userIDFromRequest func(*http.Request) string) func(http.Handler) http.Handler` `[middleware.go:HTTPLoggingMiddleware]`

## Invariants
- `NewWriterLogger(nil)` returns `NoopLogger{}` rather than a nil interface, and `(*streamLogger).Close()` is a no-op so process `os.Stderr` is never closed `[logger.go:NewWriterLogger]`, `[logger.go:Close]`.
- Categories equal to `"AUTH_FAILURE"` or ending in `"_FAILURE"` emit JSON lines with `"level": "error"`; all other categories emit `"level": "info"` `[logger.go:levelForCategory]`.
- `(*streamLogger).Log` and `HTTPLoggingMiddleware` post-handler recording recover from panics so audit logging never aborts request handling `[logger.go:Log]`, `[middleware.go:HTTPLoggingMiddleware]`.
- `loggingResponseWriter.WriteHeader` records and forwards only the first status code written, defaulting to `http.StatusOK` `[middleware.go:loggingResponseWriter]`, `[middleware.go:WriteHeader]`.
- `(*MetricsCollector).Flush` atomically snapshots and resets counters (`requestCount`, `errorCount`, `totalLatencyMs`, `activeUsers`) before formatting and emitting the `"METRICS"` line `[metrics.go:Flush]`.

## Side Effects
- Writes newline-delimited JSON audit records to `os.Stderr` (via `NewLogger`) or a caller-provided `io.Writer` under `streamLogger.mu`, falling back to `slog.Error` on marshal/write/panic failures `[logger.go:NewLogger]`, `[logger.go:Log]`.
- Reads process-wide service metadata via `logx.Service()` and `logx.Version()` `[logger.go:Log]`.
- Mutates `MetricsCollector` internal counters and `activeUsers` set under `sync.Mutex` `[metrics.go:RecordRequest]`, `[metrics.go:Flush]`.
- Logs `"ERROR"` category lines for HTTP responses with status `>= 500`, including Chi `middleware.GetReqID` when present `[middleware.go:HTTPLoggingMiddleware]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/admin` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
