# LogX

## Overview
Implements Contract v3 JSON `log/slog` logging for the backend, attaching service metadata, propagating W3C `trace_id` values from `context.Context`, expanding `error` attributes into `exception.type` and `exception.message`, and capping `exception.stacktrace` at 8 KiB.

## Interface
- Constants: `TimeFormat`, `MaxStackBytes` (`8192`), `DefaultService` (`"pn-api"`), `DefaultVersion` (`"v0.0.0"`) `[logx.go:TimeFormat]`, `[logx.go:MaxStackBytes]`, `[logx.go:DefaultService]`, `[logx.go:DefaultVersion]`
- `Service() string`, `Version() string`, `SetDefaults(service, version string)` `[logx.go:Service]`, `[logx.go:Version]`, `[logx.go:SetDefaults]`
- `WithTraceID(ctx context.Context, traceID string) context.Context`, `TraceIDFromContext(ctx context.Context) string` `[logx.go:WithTraceID]`, `[logx.go:TraceIDFromContext]`
- `New(w io.Writer, service, version string) *slog.Logger` `[logx.go:New]`
- `Exception(err error) []any`, `InnermostErrorType(err error) string`, `TruncateStacktrace(s string) string` `[logx.go:Exception]`, `[logx.go:InnermostErrorType]`, `[logx.go:TruncateStacktrace]`

## Invariants
- Timestamps are always emitted in UTC with millisecond precision using `TimeFormat` `[logx.go:replaceAttr]`.
- `InnermostErrorType` unwraps both single (`Unwrap() error`) and joined (`Unwrap() []error`) error chains to report the concrete root cause type, preferring non-`*errors.errorString` branches and normalizing `*errors.errorString` to `"errors.errorString"` `[logx.go:InnermostErrorType]`, `[logx.go:unwrapInnermost]`.
- `TruncateStacktrace` guarantees output length `<= MaxStackBytes` (`8192`), slicing at a newline boundary when possible and appending `"\n…[truncated N bytes]"` `[logx.go:TruncateStacktrace]`.
- Top-level `"error"` attributes are rewritten into `exception.message` (and `exception.type` for `error` values); any record at `LevelError` or higher lacking an exception attribute automatically sets `exception.message` from `r.Message` `[logx.go:Handle]`, `[logx.go:WithAttrs]`, `[logx.go:expandErrorAttr]`.
- `Handle` injects `trace_id` from `ctx` automatically unless a non-empty `trace_id` attribute is already present on the record or handler `[logx.go:Handle]`.

## Side Effects
- Mutates package-global `defaultService` and `defaultVersion` under `defaultMu` when `SetDefaults` or `New` is called `[logx.go:SetDefaults]`, `[logx.go:New]`.
- Writes JSON log records to `os.Stderr` (when `w == nil`) or the caller-provided `io.Writer` `[logx.go:New]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/logx` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
