package logx

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"sync"
)

const (
	TimeFormat     = "2006-01-02T15:04:05.000Z07:00"
	MaxStackBytes  = 8192
	DefaultService = "pn-api"
	DefaultVersion = "v0.0.0"
)

type traceIDContextKey struct{}

var (
	defaultMu      sync.RWMutex
	defaultService = DefaultService
	defaultVersion = DefaultVersion
)

// Service returns the process-wide service.name configured via New/SetDefault.
func Service() string {
	defaultMu.RLock()
	defer defaultMu.RUnlock()
	return defaultService
}

// Version returns the process-wide service.version configured via New/SetDefault.
func Version() string {
	defaultMu.RLock()
	defer defaultMu.RUnlock()
	return defaultVersion
}

// SetDefaults updates the package-level service.name and service.version metadata.
func SetDefaults(service, version string) {
	defaultMu.Lock()
	defer defaultMu.Unlock()
	if strings.TrimSpace(service) != "" {
		defaultService = service
	}
	if strings.TrimSpace(version) != "" {
		defaultVersion = version
	}
}

// WithTraceID stores a 32-hex W3C trace_id in ctx so log lines emitted with ctx
// automatically include trace_id.
func WithTraceID(ctx context.Context, traceID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, traceIDContextKey{}, traceID)
}

// TraceIDFromContext returns the trace_id stored in ctx, or "" if none is present.
func TraceIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if v, ok := ctx.Value(traceIDContextKey{}).(string); ok {
		return v
	}
	return ""
}

// New constructs a Contract v3 JSON *slog.Logger that formats time in UTC with
// millisecond precision, attaches service.name and service.version to every record,
// rewrites top-level "error" attributes into exception.message and exception.type
// (from the innermost unwrapped error), and caps exception.stacktrace at 8 KiB.
func New(w io.Writer, service, version string) *slog.Logger {
	if w == nil {
		w = os.Stderr
	}
	if strings.TrimSpace(service) == "" {
		service = DefaultService
	}
	if strings.TrimSpace(version) == "" {
		version = DefaultVersion
	}
	SetDefaults(service, version)

	base := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level:       slog.LevelDebug,
		ReplaceAttr: replaceAttr,
	})
	withService := base.WithAttrs([]slog.Attr{
		slog.String("service.name", service),
		slog.String("service.version", version),
	})
	return slog.New(&handler{
		inner: withService,
	})
}

// Exception returns the Contract v3 exception.type (innermost unwrapped error type)
// and exception.message attributes for err.
func Exception(err error) []any {
	if err == nil {
		return nil
	}
	return []any{
		"exception.type", InnermostErrorType(err),
		"exception.message", err.Error(),
	}
}

// InnermostErrorType unwraps err (supporting both Unwrap() error and Unwrap() []error)
// and returns the root cause's concrete type string, never an outer wrapper type.
func InnermostErrorType(err error) string {
	if err == nil {
		return ""
	}
	root := unwrapInnermost(err)
	t := fmt.Sprintf("%T", root)
	if t == "*errors.errorString" {
		return "errors.errorString"
	}
	return t
}

func unwrapInnermost(err error) error {
	curr := err
	for curr != nil {
		if u, ok := curr.(interface{ Unwrap() error }); ok {
			next := u.Unwrap()
			if next != nil {
				curr = next
				continue
			}
		}
		if u, ok := curr.(interface{ Unwrap() []error }); ok {
			errs := u.Unwrap()
			var chosen error
			for _, candidate := range errs {
				if candidate == nil {
					continue
				}
				if chosen == nil {
					chosen = candidate
				}
				leaf := unwrapInnermost(candidate)
				if fmt.Sprintf("%T", leaf) != "*errors.errorString" {
					chosen = candidate
					break
				}
			}
			if chosen != nil {
				curr = chosen
				continue
			}
		}
		break
	}
	return curr
}

// TruncateStacktrace caps a stack trace at 8 KiB (8192 bytes), keeping the top
// frames and cutting at a newline boundary with "\n…[truncated N bytes]".
func TruncateStacktrace(s string) string {
	if len(s) <= MaxStackBytes {
		return s
	}
	origLen := len(s)
	// Reserve enough room for the suffix "\n…[truncated <digits> bytes]" so the
	// resulting string is always <= MaxStackBytes bytes.
	estSuffix := fmt.Sprintf("\n…[truncated %d bytes]", origLen)
	maxCut := MaxStackBytes - len(estSuffix)
	if maxCut < 1 {
		maxCut = 1
	}
	slice := s[:maxCut]
	cutPos := maxCut
	if idx := strings.LastIndexByte(slice, '\n'); idx > 0 {
		cutPos = idx
	}
	removed := origLen - cutPos
	suffix := fmt.Sprintf("\n…[truncated %d bytes]", removed)
	for cutPos > 0 && cutPos+len(suffix) > MaxStackBytes {
		cutPos--
		removed = origLen - cutPos
		suffix = fmt.Sprintf("\n…[truncated %d bytes]", removed)
	}
	return s[:cutPos] + suffix
}

func replaceAttr(groups []string, a slog.Attr) slog.Attr {
	if len(groups) == 0 && a.Key == slog.TimeKey && a.Value.Kind() == slog.KindTime {
		return slog.String(slog.TimeKey, a.Value.Time().UTC().Format(TimeFormat))
	}
	if len(groups) == 0 && a.Key == "exception.stacktrace" {
		return slog.String("exception.stacktrace", TruncateStacktrace(a.Value.String()))
	}
	return a
}

type handler struct {
	inner     slog.Handler
	inGroup   bool
	hasErrMsg bool
	hasTrace  bool
}

func (h *handler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

func (h *handler) Handle(ctx context.Context, r slog.Record) error {
	out := slog.NewRecord(r.Time, r.Level, r.Message, r.PC)

	hasException := h.hasErrMsg
	hasTrace := h.hasTrace

	r.Attrs(func(a slog.Attr) bool {
		if !h.inGroup {
			switch a.Key {
			case "error":
				for _, expanded := range expandErrorAttr(a) {
					if expanded.Key == "exception.message" || expanded.Key == "exception.type" {
						hasException = true
					}
					out.AddAttrs(expanded)
				}
				return true
			case "exception.message", "exception.type":
				if a.Value.String() != "" {
					hasException = true
				}
			case "exception.stacktrace":
				a = slog.String("exception.stacktrace", TruncateStacktrace(a.Value.String()))
			case "trace_id":
				if a.Value.String() != "" {
					hasTrace = true
				}
			}
		}
		out.AddAttrs(a)
		return true
	})

	if !hasTrace {
		if tid := TraceIDFromContext(ctx); tid != "" {
			out.AddAttrs(slog.String("trace_id", tid))
		}
	}

	if r.Level >= slog.LevelError && !hasException && r.Message != "" {
		out.AddAttrs(slog.String("exception.message", r.Message))
	}

	return h.inner.Handle(ctx, out)
}

func (h *handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	if h.inGroup {
		return &handler{
			inner:     h.inner.WithAttrs(attrs),
			inGroup:   true,
			hasErrMsg: h.hasErrMsg,
			hasTrace:  h.hasTrace,
		}
	}
	transformed := make([]slog.Attr, 0, len(attrs)+1)
	hasErrMsg := h.hasErrMsg
	hasTrace := h.hasTrace
	for _, a := range attrs {
		switch a.Key {
		case "error":
			for _, expanded := range expandErrorAttr(a) {
				if expanded.Key == "exception.message" || expanded.Key == "exception.type" {
					hasErrMsg = true
				}
				transformed = append(transformed, expanded)
			}
		case "exception.message", "exception.type":
			if a.Value.String() != "" {
				hasErrMsg = true
			}
			transformed = append(transformed, a)
		case "exception.stacktrace":
			transformed = append(transformed, slog.String("exception.stacktrace", TruncateStacktrace(a.Value.String())))
		case "trace_id":
			if a.Value.String() != "" {
				hasTrace = true
			}
			transformed = append(transformed, a)
		default:
			transformed = append(transformed, a)
		}
	}
	return &handler{
		inner:     h.inner.WithAttrs(transformed),
		inGroup:   false,
		hasErrMsg: hasErrMsg,
		hasTrace:  hasTrace,
	}
}

func (h *handler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	return &handler{
		inner:     h.inner.WithGroup(name),
		inGroup:   true,
		hasErrMsg: h.hasErrMsg,
		hasTrace:  h.hasTrace,
	}
}

func expandErrorAttr(a slog.Attr) []slog.Attr {
	val := a.Value.Resolve().Any()
	if val == nil {
		return nil
	}
	if err, ok := val.(error); ok {
		return []slog.Attr{
			slog.String("exception.message", err.Error()),
			slog.String("exception.type", InnermostErrorType(err)),
		}
	}
	msg := fmt.Sprint(val)
	if msg == "" {
		return nil
	}
	return []slog.Attr{
		slog.String("exception.message", msg),
	}
}
