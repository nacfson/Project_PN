package admin

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// HTTPLoggingMiddleware records request metrics and logs 5xx responses.
// A nil logger is treated as a no-op logger; a nil collector skips metrics collection.
func HTTPLoggingMiddleware(logger Logger, collector *MetricsCollector, userIDFromRequest func(*http.Request) string) func(http.Handler) http.Handler {
	if logger == nil {
		logger = NoopLogger{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(ww, r)

			func() {
				defer func() {
					if rec := recover(); rec != nil {
						slog.Error("admin: panic in HTTP logging middleware post-handler", "recover", rec)
					}
				}()

				latencyMs := time.Since(start).Milliseconds()
				userID := ""
				if userIDFromRequest != nil {
					userID = userIDFromRequest(r)
				}
				if collector != nil {
					collector.RecordRequest(ww.statusCode, latencyMs, userID)
				}
				if ww.statusCode >= 500 {
					reqID := middleware.GetReqID(r.Context())
					if reqID != "" {
						logger.Logf("ERROR", "%s %s returned %d in %dms request_id=%s", r.Method, r.URL.Path, ww.statusCode, latencyMs, reqID)
					} else {
						logger.Logf("ERROR", "%s %s returned %d in %dms", r.Method, r.URL.Path, ww.statusCode, latencyMs)
					}
				}
			}()
		})
	}
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
	wrote      bool
}

func (w *loggingResponseWriter) WriteHeader(code int) {
	if !w.wrote {
		w.statusCode = code
		w.wrote = true
		w.ResponseWriter.WriteHeader(code)
	}
}
