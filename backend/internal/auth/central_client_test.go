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
