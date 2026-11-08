package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"project-pn/internal/logx"
)

type loggerContextKey struct{}

const zeroTraceID = "00000000000000000000000000000000"

// WithLogger stores a request-scoped *slog.Logger in ctx.
func WithLogger(ctx context.Context, logger *slog.Logger) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, loggerContextKey{}, logger)
}

// LoggerFromContext returns the request-scoped *slog.Logger stored in ctx,
// falling back to slog.Default() (enriched with trace_id if present in ctx).
func LoggerFromContext(ctx context.Context) *slog.Logger {
	if ctx != nil {
		if l, ok := ctx.Value(loggerContextKey{}).(*slog.Logger); ok && l != nil {
			return l
		}
		if tid := logx.TraceIDFromContext(ctx); tid != "" {
			return slog.Default().With("trace_id", tid)
		}
	}
	return slog.Default()
}

// TraceIDFromContext returns the 32-hex trace_id stored in ctx, or "".
func TraceIDFromContext(ctx context.Context) string {
	return logx.TraceIDFromContext(ctx)
}

// ParseTraceparent extracts the 32-character lowercase hex trace_id from a W3C
// traceparent header ("00-<32hex>-<16hex>-<2hex>").
func ParseTraceparent(header string) (string, bool) {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(header)), "-")
	if len(parts) < 4 {
		return "", false
	}
	version, traceID, parentID, flags := parts[0], parts[1], parts[2], parts[3]
	if !isLowerHex(version, 2) || version == "ff" {
		return "", false
	}
	if !isLowerHex(traceID, 32) || traceID == zeroTraceID {
		return "", false
	}
	if !isLowerHex(parentID, 16) || !isLowerHex(flags, 2) {
		return "", false
	}
	return traceID, true
}

// NewTraceID returns a new random 16-byte (32 lowercase hex character) trace_id.
func NewTraceID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "0123456789abcdef0123456789abcdef"
	}
	s := hex.EncodeToString(b[:])
	if s == zeroTraceID {
		return "00000000000000000000000000000001"
	}
	return s
}

func isLowerHex(s string, wantLen int) bool {
	if len(s) != wantLen {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

// Middleware parses W3C traceparent (or generates a 32-hex trace_id if absent),
// attaches trace_id to the request logger in r.Context(), and emits one Contract v3
// access log line per request. If baseLogger is nil, slog.Default() is used.
func Middleware(baseLogger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			traceID, ok := ParseTraceparent(r.Header.Get("traceparent"))
			if !ok {
				traceID = NewTraceID()
			}

			logger := baseLogger
			if logger == nil {
				logger = slog.Default()
			}
			reqLogger := logger.With("trace_id", traceID)

			ctx := logx.WithTraceID(r.Context(), traceID)
			ctx = WithLogger(ctx, reqLogger)
			r = r.WithContext(ctx)

			rw := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rw, r)

			duration := time.Since(start).Seconds()
			status := rw.status
			if status == 0 {
				status = http.StatusOK
			}

			msg := fmt.Sprintf("%s %s %d", r.Method, r.URL.Path, status)
			attrs := []any{
				"http.request.method", r.Method,
				"url.path", r.URL.Path,
				"http.response.status_code", status,
				"http.server.request.duration", duration,
			}
			if status >= 500 {
				reqLogger.ErrorContext(ctx, msg, attrs...)
			} else {
				reqLogger.InfoContext(ctx, msg, attrs...)
			}
		})
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (r *statusRecorder) WriteHeader(code int) {
	if !r.wrote {
		r.status = code
		r.wrote = true
		r.ResponseWriter.WriteHeader(code)
	}
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if !r.wrote {
		r.status = http.StatusOK
		r.wrote = true
	}
	return r.ResponseWriter.Write(b)
}

func (r *statusRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}
