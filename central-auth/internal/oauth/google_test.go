package oauth

import (
	"testing"

	"github.com/nacfson/central-auth/internal/config"
)

func TestShouldIssueCookieForRedirect(t *testing.T) {
	t.Parallel()
	if !shouldIssueCookieForRedirect("http://localhost:8081") {
		t.Fatal("expected http redirect to issue cookie")
	}
	if shouldIssueCookieForRedirect("projectpn://auth") {
		t.Fatal("expected custom scheme to skip cookie")
	}
}

func TestGoogleConfigured(t *testing.T) {
	t.Parallel()
	cfg := config.Config{GoogleClientID: "id", GoogleClientSecret: "secret"}
	if !cfg.GoogleConfigured() {
		t.Fatal("expected configured google oauth")
	}
}
