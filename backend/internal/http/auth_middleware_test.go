package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCentralUserFromProxyHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("X-User-Id", "central-user-1")
	req.Header.Set("X-User-Email", "Person@Example.COM")
	req.Header.Set("X-User-Roles", "viewer, admin")

	user, ok := centralUserFromProxyHeaders(req)
	if !ok {
		t.Fatal("expected proxy central user")
	}
	if user.ID != "central-user-1" {
		t.Fatalf("ID = %q", user.ID)
	}
	if user.Email != "Person@Example.COM" {
		t.Fatalf("Email = %q", user.Email)
	}
	if !user.IsAdmin {
		t.Fatal("expected admin role")
	}
}

func TestCentralUserFromProxyHeadersRejectsMissingIdentity(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("X-User-Email", "person@example.com")

	if _, ok := centralUserFromProxyHeaders(req); ok {
		t.Fatal("expected missing proxy user id to be rejected")
	}
}
