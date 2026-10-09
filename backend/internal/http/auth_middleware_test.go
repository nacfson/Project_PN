package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

type fakeCentralUserService struct {
	user auth.User
}

func (f fakeCentralUserService) EnsureCentralUser(_ context.Context, _ auth.CentralSession) (auth.AuthResult, error) {
	return auth.AuthResult{User: f.user}, nil
}

func (f fakeCentralUserService) EnsurePlatformIdentity(_ context.Context, identity auth.ConfirmedIdentity) (auth.User, error) {
	if f.user.ID != "" {
		return f.user, nil
	}
	return auth.User{
		ID:    identity.Subject,
		Email: identity.Subject + "@" + identity.Audience,
	}, nil
}

func createTestToken(issuer, subject, audience string, expiry time.Time) string {
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

func TestCentralAuthMiddleware_RejectsProxyHeaders(t *testing.T) {
	svc := &auth.Service{}
	central := auth.NewCentralClient("http://unused.invalid", nil)
	mw := authMiddleware(svc, central, nil, admin.NoopLogger{})

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
	var response struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if response.Code != "AUTH-101" {
		t.Fatalf("expected AUTH-101, got %q", response.Code)
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
	mw := authMiddleware(fakeCentralUserService{user: auth.User{ID: "local-cookie-user", Email: "cookie@example.com"}}, central, nil, admin.NoopLogger{})

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
	mw := authMiddleware(fakeCentralUserService{}, central, nil, admin.NoopLogger{})
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
	mw := authMiddleware(fakeCentralUserService{user: auth.User{ID: "central-local-user", Email: "real@example.com"}}, central, nil, admin.NoopLogger{})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer native-token")
	req.Header.Set("X-User-Id", "attacker-id")
	req.Header.Set("X-User-Email", "attacker@example.com")
	req.Header.Set("X-User-Roles", "admin")
	req.Header.Set("X-User-Subject", "attacker-subject")
	req.Header.Set("X-User-Issuer", "attacker-issuer")
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := userFromContext(r.Context())
		if !ok || user.ID != "central-local-user" || user.Email != "real@example.com" {
			t.Fatalf("expected central user, got %+v", user)
		}
		for _, header := range []string{"X-User-Id", "X-User-Email", "X-User-Roles", "X-User-Subject", "X-User-Issuer"} {
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

func TestGatewayAuthMiddleware_SharedSuccess(t *testing.T) {
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := createTestToken("https://auth.example.com", "sub-456", "project-pn", time.Now().Add(time.Hour))
		w.Header().Set("Authorization", "Bearer "+token)
		w.Header().Set("X-User-Subject", "sub-456")
		w.Header().Set("X-User-Issuer", "https://auth.example.com")
		w.WriteHeader(http.StatusOK)
	}))
	defer gatewayServer.Close()

	gateway := auth.NewGatewayClient(gatewayServer.URL, auth.SignInShared, gatewayServer.Client())
	mw := authMiddleware(fakeCentralUserService{}, nil, gateway, admin.NoopLogger{})

	req := httptest.NewRequest(http.MethodGet, "/api/learning-items", nil)
	req.Host = "pn.example.com"
	req.AddCookie(&http.Cookie{Name: "PLATFORM_SESSION", Value: "session-val"})
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := userFromContext(r.Context())
		if !ok || user.ID != "sub-456" {
			t.Fatalf("expected user sub-456 from platform confirmation, got %+v", user)
		}
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGatewayAuthMiddleware_SignInNoneRejectsWithoutGatewayCall(t *testing.T) {
	called := false
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer gatewayServer.Close()

	gateway := auth.NewGatewayClient(gatewayServer.URL, auth.SignInNone, gatewayServer.Client())
	mw := authMiddleware(fakeCentralUserService{}, nil, gateway, admin.NoopLogger{})

	req := httptest.NewRequest(http.MethodGet, "/api/learning-items", nil)
	req.Host = "pn.example.com"
	req.AddCookie(&http.Cookie{Name: "PLATFORM_SESSION", Value: "session-val"})
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not be called when signIn is none")
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for signIn: none, got %d", rec.Code)
	}
	if called {
		t.Fatal("gateway must NOT be called when signIn is none")
	}
}

func TestGatewayAuthMiddleware_UnreachableGatewayLeavesUnsignedIn(t *testing.T) {
	gateway := auth.NewGatewayClient("http://127.0.0.1:54321/auth", auth.SignInShared, &http.Client{Timeout: 50 * time.Millisecond})
	mw := authMiddleware(fakeCentralUserService{}, nil, gateway, admin.NoopLogger{})

	req := httptest.NewRequest(http.MethodGet, "/api/learning-items", nil)
	req.Host = "pn.example.com"
	req.AddCookie(&http.Cookie{Name: "PLATFORM_SESSION", Value: "session-val"})
	rec := httptest.NewRecorder()

	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler must not be called when gateway is unreachable")
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when gateway unreachable, got %d", rec.Code)
	}
}
