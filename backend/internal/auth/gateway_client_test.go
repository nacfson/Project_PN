package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func createTestJWT(issuer, subject, audience string, expiry time.Time) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	claims := map[string]interface{}{
		"iss": issuer,
		"sub": subject,
		"aud": audience,
		"exp": expiry.Unix(),
	}
	claimsBytes, _ := json.Marshal(claims)
	payload := base64.RawURLEncoding.EncodeToString(claimsBytes)
	return fmt.Sprintf("%s.%s.", header, payload)
}

func TestDeriveProjectAudience(t *testing.T) {
	cases := []struct {
		host     string
		expected string
	}{
		{"pn.example.com", "project-pn"},
		{"pn.nacfson.cloud", "project-pn"},
		{"pn.example.com:8080", "project-pn"},
		{"other.example.com", "project-other"},
		{"custom.domain.com", "project-custom"},
	}

	for _, c := range cases {
		got := DeriveProjectAudience(c.host)
		if got != c.expected {
			t.Errorf("DeriveProjectAudience(%q) = %q, expected %q", c.host, got, c.expected)
		}
	}
}

func TestGatewayClient_SignInNoneMustNotCallGateway(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewGatewayClient(server.URL, SignInNone, server.Client())
	ident, err := client.ConfirmIdentity(context.Background(), "pn.example.com", []*http.Cookie{{Name: "SESSION", Value: "val"}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ident != nil {
		t.Fatalf("expected nil identity for signIn: none, got %+v", ident)
	}
	if called {
		t.Fatal("gateway must NOT be called when signIn is none")
	}
}

func TestGatewayClient_MissingCookieLeavesUnsignedIn(t *testing.T) {
	client := NewGatewayClient("http://gateway.identity.svc:8080/auth", SignInShared, nil)
	ident, err := client.ConfirmIdentity(context.Background(), "pn.example.com", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ident != nil {
		t.Fatalf("expected nil identity when no cookies, got %+v", ident)
	}
}

func TestGatewayClient_UnreachableGatewayLeavesUnsignedIn(t *testing.T) {
	client := NewGatewayClient("http://127.0.0.1:54321/auth", SignInShared, &http.Client{Timeout: 50 * time.Millisecond})
	ident, err := client.ConfirmIdentity(context.Background(), "pn.example.com", []*http.Cookie{{Name: "SESSION", Value: "val"}})
	if err != nil {
		t.Fatalf("unreachable gateway should not return fatal error, got %v", err)
	}
	if ident != nil {
		t.Fatalf("expected nil identity when gateway unreachable, got %+v", ident)
	}
}

func TestGatewayClient_RejectsForeignAudience(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := createTestJWT("https://auth.example.com", "user-123", "project-other", time.Now().Add(time.Hour))
		w.Header().Set("Authorization", "Bearer "+token)
		w.Header().Set("X-User-Subject", "user-123")
		w.Header().Set("X-User-Issuer", "https://auth.example.com")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewGatewayClient(server.URL, SignInShared, server.Client())
	ident, err := client.ConfirmIdentity(context.Background(), "pn.example.com", []*http.Cookie{{Name: "SESSION", Value: "val"}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ident != nil {
		t.Fatalf("expected foreign audience to be rejected, got %+v", ident)
	}
}

func TestGatewayClient_RejectsExpiredToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := createTestJWT("https://auth.example.com", "user-123", "project-pn", time.Now().Add(-10*time.Minute))
		w.Header().Set("Authorization", "Bearer "+token)
		w.Header().Set("X-User-Subject", "user-123")
		w.Header().Set("X-User-Issuer", "https://auth.example.com")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewGatewayClient(server.URL, SignInShared, server.Client())
	ident, err := client.ConfirmIdentity(context.Background(), "pn.example.com", []*http.Cookie{{Name: "SESSION", Value: "val"}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ident != nil {
		t.Fatalf("expected expired token to be rejected, got %+v", ident)
	}
}

func TestGatewayClient_AcceptsValidConfirmedIdentity(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Forwarded-Host") != "pn.example.com" {
			t.Errorf("expected X-Forwarded-Host 'pn.example.com', got %q", r.Header.Get("X-Forwarded-Host"))
		}
		cookie, err := r.Cookie("PLATFORM_SESSION")
		if err != nil || cookie.Value != "valid-cookie-val" {
			t.Errorf("expected cookie, got %v", err)
		}
		token := createTestJWT("https://auth.example.com", "user-123", "project-pn", time.Now().Add(time.Hour))
		w.Header().Set("Authorization", "Bearer "+token)
		w.Header().Set("X-User-Subject", "user-123")
		w.Header().Set("X-User-Issuer", "https://auth.example.com")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewGatewayClient(server.URL, SignInShared, server.Client())
	ident, err := client.ConfirmIdentity(context.Background(), "pn.example.com", []*http.Cookie{{Name: "PLATFORM_SESSION", Value: "valid-cookie-val"}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ident == nil {
		t.Fatal("expected confirmed identity, got nil")
	}
	if ident.Subject != "user-123" {
		t.Errorf("expected subject 'user-123', got %q", ident.Subject)
	}
	if ident.Issuer != "https://auth.example.com" {
		t.Errorf("expected issuer 'https://auth.example.com', got %q", ident.Issuer)
	}
	if ident.Audience != "project-pn" {
		t.Errorf("expected audience 'project-pn', got %q", ident.Audience)
	}
}
