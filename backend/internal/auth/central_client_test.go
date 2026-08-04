package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCentralClientValidateSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/auth/session" {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer central-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"expires_at":"2026-06-28T12:00:00Z","user":{"id":"central-user","email":"USER@Example.COM","is_admin":true}}`))
	}))
	defer server.Close()

	client := NewCentralClient(server.URL, server.Client())
	session, err := client.ValidateSession(context.Background(), "central-token")
	if err != nil {
		t.Fatalf("ValidateSession: %v", err)
	}
	if session.User.ID != "central-user" {
		t.Fatalf("expected central-user, got %q", session.User.ID)
	}
	if session.User.Email != "user@example.com" {
		t.Fatalf("expected normalized email, got %q", session.User.Email)
	}
	if !session.User.IsAdmin {
		t.Fatal("expected admin user")
	}
	if session.ExpiresAt.IsZero() {
		t.Fatal("expected expires_at")
	}
}

func TestCentralClientValidateSessionRejectsUnauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	client := NewCentralClient(server.URL, server.Client())
	_, err := client.ValidateSession(context.Background(), "bad-token")
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}

func TestCentralClientValidateCookieSessionForwardsCookieAndInternalAuth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/internal/cookie-session" {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer internal-secret" {
			t.Fatalf("unexpected internal auth header %q", r.Header.Get("Authorization"))
		}
		cookie, err := r.Cookie(CentralSessionCookieName)
		if err != nil || cookie.Value != "shared-cookie-value" {
			t.Fatalf("unexpected session cookie: %v, %#v", err, cookie)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"user_id":"central-cookie-user","email":"COOKIE@Example.COM","is_admin":false,"expires_at":"2099-01-01T00:00:00Z"}`))
	}))
	defer server.Close()

	client := NewCentralClientWithInternalAuth("https://public.example", server.URL, "internal-secret", server.Client())
	session, err := client.ValidateCookieSession(context.Background(), "shared-cookie-value")
	if err != nil {
		t.Fatalf("ValidateCookieSession: %v", err)
	}
	if session.User.ID != "central-cookie-user" {
		t.Fatalf("expected central-cookie-user, got %q", session.User.ID)
	}
	if session.User.Email != "cookie@example.com" {
		t.Fatalf("expected normalized email, got %q", session.User.Email)
	}
}

func TestCentralClientValidateCookieSessionRejectsInvalidAndExpired(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
	}{
		{
			name:       "invalid response",
			statusCode: http.StatusUnauthorized,
			body:       `{"error":"invalid session"}`,
		},
		{
			name:       "expired response",
			statusCode: http.StatusOK,
			body:       `{"user_id":"central-user","email":"user@example.com","is_admin":false,"expires_at":"2020-01-01T00:00:00Z"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				w.Write([]byte(tt.body))
			}))
			defer server.Close()

			client := NewCentralClientWithInternalAuth("", server.URL, "internal-secret", server.Client())
			_, err := client.ValidateCookieSession(context.Background(), "bad-or-expired")
			if !errors.Is(err, ErrInvalidToken) {
				t.Fatalf("expected ErrInvalidToken, got %v", err)
			}
		})
	}
}

func TestCentralClientLogout(t *testing.T) {
	var sawDelete bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Fatalf("unexpected method %s", r.Method)
		}
		if r.URL.Path != "/api/auth/session" {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer central-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		sawDelete = true
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewCentralClient(server.URL, &http.Client{Timeout: time.Second})
	if err := client.Logout(context.Background(), "central-token"); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if !sawDelete {
		t.Fatal("expected DELETE request")
	}
}

func TestCentralClientLogoutCookieSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Fatalf("unexpected method %s", r.Method)
		}
		if r.URL.Path != "/api/auth/session" {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		cookie, err := r.Cookie(CentralSessionCookieName)
		if err != nil || cookie.Value != "shared-cookie-value" {
			t.Fatalf("unexpected session cookie: %v, %#v", err, cookie)
		}
		if got := r.Header.Get("Authorization"); got != "" {
			t.Fatalf("cookie logout must not expose the internal token as a session token, got %q", got)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewCentralClientWithInternalAuth("", server.URL, "internal-secret", server.Client())
	if err := client.LogoutCookieSession(context.Background(), "shared-cookie-value"); err != nil {
		t.Fatalf("LogoutCookieSession: %v", err)
	}
}
