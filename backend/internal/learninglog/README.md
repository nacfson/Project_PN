# LearningLog

## Overview
Encodes domain learning events (added items, review attempts, sense changes, archives, and personal notes) into logfmt-style key/value lines and appends them to daily UTC log files on disk.

## Interface
- `QuoteValue(s string) string`, `FormatRow(ts time.Time, event string, fields [][2]string) string` `[encode.go:QuoteValue]`, `[encode.go:FormatRow]`
- `LearningItemAddedParams`, `ReviewAttemptedParams`, `SenseChangedParams`, `LearningItemArchivedParams`, `PersonalMeaningSetParams` `[events.go:LearningItemAddedParams]`, `[events.go:ReviewAttemptedParams]`, `[events.go:SenseChangedParams]`, `[events.go:LearningItemArchivedParams]`, `[events.go:PersonalMeaningSetParams]`
- `RowLearningItemAdded`, `RowReviewAttempted`, `RowSenseChanged`, `RowLearningItemArchived`, `RowPersonalMeaningSet`, `FormatFloat` `[events.go:RowLearningItemAdded]`, `[events.go:RowReviewAttempted]`, `[events.go:RowSenseChanged]`, `[events.go:RowLearningItemArchived]`, `[events.go:RowPersonalMeaningSet]`, `[events.go:FormatFloat]`
- `Logger`, `NoopLogger`, `FileLogger`, `NewLogger(dir string) (Logger, error)`, `DailyFilename(ts time.Time) string`, `(*FileLogger).WriteLine(ts time.Time, line string)`, `(*FileLogger).Close() error` `[logger.go:Logger]`, `[logger.go:NoopLogger]`, `[logger.go:FileLogger]`, `[logger.go:NewLogger]`, `[logger.go:DailyFilename]`, `[logger.go:WriteLine]`, `[logger.go:Close]`

## Invariants
- `NewLogger("")` returns `NoopLogger{}, nil` without touching the filesystem `[logger.go:NewLogger]`.
- `DailyFilename` always formats filenames in UTC as `YYYYMMDD_log` `[logger.go:DailyFilename]`, and `FormatRow` always formats `ts` in UTC RFC 3339 `[encode.go:FormatRow]`.
- `QuoteValue` leaves strings composed solely of letters, digits, `_`, `.`, `:`, and `-` unquoted, and double-quotes empty strings or strings containing any other rune while escaping `\` and `"` `[encode.go:QuoteValue]`, `[encode.go:safeValueRune]`.
- `RowReviewAttempted` omits the `response_time_ms` field when `ResponseTimeMs == nil` `[events.go:RowReviewAttempted]`.
- `(*FileLogger).WriteLine` recovers from panics and swallows open/write errors (logging via `slog.Error`) so learning-log I/O never crashes callers `[logger.go:WriteLine]`.

## Side Effects
- Creates the target log directory (`0o750`) on `NewLogger(dir)` via `os.MkdirAll` `[logger.go:NewLogger]`.
- Opens, appends a newline-terminated line to, and closes `<dir>/<YYYYMMDD>_log` (`0o640`) under `FileLogger.mu` on each `WriteLine` call, logging errors via `slog.Error` `[logger.go:WriteLine]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/learninglog` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
