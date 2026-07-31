package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

type fakeCentralUserService struct {
	user auth.User
}

func (f fakeCentralUserService) EnsureCentralUser(_ context.Context, _ auth.CentralUser) (auth.User, error) {
	return f.user, nil
}

func TestCentralAuthMiddleware_RejectsProxyHeaders(t *testing.T) {
	svc := &auth.Service{}
	central := auth.NewCentralClient("http://unused.invalid", nil)
	mw := authMiddleware(svc, central, admin.NoopLogger{})

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

func TestCentralAuthMiddleware_UsesCookieSessionAndIgnoresBearer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/internal/cookie-session" {
			t.Fatalf("expected cookie-session endpoint, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer internal-secret" {
			t.Fatalf("expected internal auth header, got %q", r.Header.Get("Authorization"))
		}
		cookie, err := r.Cookie(auth.CentralSessionCookieName)
		if err != nil || cookie.Value != "cookie-value" {
			t.Fatalf("expected forwarded cookie, got %v %#v", err, cookie)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"user_id":"central-cookie-user","email":"cookie@example.com","is_admin":false,"expires_at":"2099-01-01T00:00:00Z"}`))
	}))
	defer server.Close()

	central := auth.NewCentralClientWithInternalAuth("", server.URL, "internal-secret", server.Client())
	mw := authMiddleware(fakeCentralUserService{user: auth.User{ID: "local-cookie-user", Email: "cookie@example.com"}}, central, admin.NoopLogger{})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: auth.CentralSessionCookieName, Value: "cookie-value"})
	req.Header.Set("Authorization", "Bearer native-token")
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := userFromContext(r.Context())
		if !ok || user.ID != "local-cookie-user" {
			t.Fatalf("expected local user from cookie identity, got %+v", user)
		}
		session, ok := authSessionFromContext(r.Context())
		if !ok || session.method != authMethodCookie {
			t.Fatalf("expected cookie auth session, got %+v", session)
		}
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestCentralAuthMiddlewareCookieTakesPrecedenceWhenInvalid(t *testing.T) {
	var paths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		if r.URL.Path == "/api/internal/cookie-session" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		t.Fatalf("bearer validation must not run when cookie is present")
	}))
	defer server.Close()

	central := auth.NewCentralClientWithInternalAuth("", server.URL, "internal-secret", server.Client())
	mw := authMiddleware(fakeCentralUserService{}, central, admin.NoopLogger{})
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: auth.CentralSessionCookieName, Value: "expired-cookie"})
	req.Header.Set("Authorization", "Bearer native-token")
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Fatal("next handler must not be called")
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if len(paths) != 1 || paths[0] != "/api/internal/cookie-session" {
		t.Fatalf("unexpected central auth calls: %v", paths)
	}
}

func TestCentralAuthMiddlewareIgnoresSpoofedIdentityHeadersForValidBearer(t *testing.T) {
	central := mockCentralClient(t)
	mw := authMiddleware(fakeCentralUserService{user: auth.User{ID: "central-local-user", Email: "real@example.com"}}, central, admin.NoopLogger{})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer native-token")
	req.Header.Set("X-User-Id", "attacker-id")
	req.Header.Set("X-User-Email", "attacker@example.com")
	req.Header.Set("X-User-Roles", "admin")
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := userFromContext(r.Context())
		if !ok || user.ID != "central-local-user" || user.Email != "real@example.com" {
			t.Fatalf("expected central user, got %+v", user)
		}
		for _, header := range []string{"X-User-Id", "X-User-Email", "X-User-Roles"} {
			if got := r.Header.Get(header); got != "" {
				t.Fatalf("expected spoofed header %s to be removed, got %q", header, got)
			}
		}
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
