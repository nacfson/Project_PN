package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"project-pn/internal/analytics"
)

type analyticsResponseWriter struct {
	http.ResponseWriter
	status int
}

func (w *analyticsResponseWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *analyticsResponseWriter) Write(body []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(body)
}

func analyticsRequestMiddleware(logger analytics.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/analytics/events" {
				next.ServeHTTP(w, r)
				return
			}
			started := time.Now()
			wrapped := &analyticsResponseWriter{ResponseWriter: w}
			next.ServeHTTP(wrapped, r)
			status := wrapped.status
			if status == 0 {
				status = http.StatusOK
			}
			name := "api_request_completed"
			if status >= http.StatusBadRequest {
				name = "api_request_failed"
			}
			logger.Emit(analytics.NewServerRecord(name, r.Header.Get("X-Client-Trace-Id"), map[string]any{
				"method": r.Method, "path": r.URL.Path, "status": status,
				"duration_ms": time.Since(started).Milliseconds(), "request_id": middleware.GetReqID(r.Context()),
			}))
		})
	}
}
