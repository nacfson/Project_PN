package admin

import (
	"net/http"
	"time"
)

// HTTPLoggingMiddleware records request metrics and logs 5xx responses.
func HTTPLoggingMiddleware(logger Logger, collector *MetricsCollector, userIDFromRequest func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(ww, r)

			latencyMs := time.Since(start).Milliseconds()
			userID := ""
			if userIDFromRequest != nil {
				userID = userIDFromRequest(r)
			}
			collector.RecordRequest(ww.statusCode, latencyMs, userID)
			if ww.statusCode >= 500 {
				logger.Logf("ERROR", "%s %s returned %d in %dms", r.Method, r.URL.Path, ww.statusCode, latencyMs)
			}
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
