package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"project-pn/internal/auth"
)

func TestCentralAuthMiddleware_RejectsProxyHeaders(t *testing.T) {
	svc := &auth.Service{}
	central := auth.NewCentralClient("http://unused.invalid", nil)
	mw := centralAuthMiddleware(svc, central)

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("X-User-Id", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("X-User-Email", "attacker@example.com")
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}
