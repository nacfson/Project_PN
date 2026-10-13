package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"project-pn/internal/auth"
)

func TestAuthMiddlewareLogsValidationFailure(t *testing.T) {
	// Central returns 401 for every session request, so ValidateSession errors.
	verifier := auth.NewJWTVerifier(auth.JWTVerifierConfig{
		Issuer:   "https://auth.nacfson.cloud/realms/platform",
		Audience: "project-pn",
	})
	logger := &fakeLogger{}
	mw := authMiddleware(verifier, nil, false, nil, logger)

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	rec := httptest.NewRecorder()

	mw(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if nextCalled {
		t.Error("next handler should not have been called")
	}
	if !logger.has("AUTH_FAILURE", "jwt verification failed") {
		t.Fatalf("expected AUTH_FAILURE log, got %+v", logger.entries())
	}
}

func TestAuthRequireVerifiedLogsForUnverifiedUser(t *testing.T) {
	logger := &fakeLogger{}
	mw := requireVerified(logger)

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/words/lookup", nil)
	ctx := withUser(req.Context(), auth.User{
		ID:    "user-1",
		Email: "unverified@example.com",
	})
	rec := httptest.NewRecorder()

	mw(next).ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
	if nextCalled {
		t.Error("next handler should not have been called")
	}
	if !logger.has("VERIFY_REQUIRED", "email is not verified") {
		t.Fatalf("expected VERIFY_REQUIRED log, got %+v", logger.entries())
	}
}

func TestAuthMeLogsIdentityConfirmation(t *testing.T) {
	logger := &fakeLogger{}
	_, authSvc := testAuthRouter(t)
	h := &authHandler{svc: authSvc, logger: logger}

	ctx := context.Background()
	email := uniqueEmail("me-log")
	authResult, err := authSvc.EnsureCentralUser(ctx, auth.SessionFromCentralUser(auth.CentralUser{
		ID:    "central-" + email,
		Email: email,
	}, "google"))
	if err != nil {
		t.Fatalf("ensure user: %v", err)
	}
	user := authResult.User
	verifiedAt := time.Now().UTC()
	user.EmailVerifiedAt = &verifiedAt

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	reqCtx := withUser(req.Context(), user)
	reqCtx = withAuthResult(reqCtx, authResult)
	rec := httptest.NewRecorder()

	h.me(rec, req.WithContext(reqCtx))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !logger.has("AUTH", "identity confirmed") {
		t.Fatalf("expected AUTH log for identity confirmation, got %+v", logger.entries())
	}
}

func TestAuthCentralLogoutLogsSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	central := auth.NewCentralClient(srv.URL, nil)
	logger := &fakeLogger{}
	handler := centralLogout(central, logger)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer token")
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if !logger.has("AUTH", "logout from") {
		t.Fatalf("expected AUTH logout log, got %+v", logger.entries())
	}
}

func TestAuthCentralLogoutLogsFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	central := auth.NewCentralClient(srv.URL, nil)
	logger := &fakeLogger{}
	handler := centralLogout(central, logger)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer token")
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if !logger.has("AUTH_FAILURE", "logout failed") {
		t.Fatalf("expected AUTH_FAILURE logout log, got %+v", logger.entries())
	}
}

func TestAuthCentralLogoutRevokesCookieAndClearsBrowserCookie(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete || r.URL.Path != "/api/auth/session" {
			t.Fatalf("unexpected logout request: %s %s", r.Method, r.URL.Path)
		}
		cookie, err := r.Cookie(auth.CentralSessionCookieName)
		if err != nil || cookie.Value != "cookie-value" {
			t.Fatalf("expected forwarded cookie, got %v %#v", err, cookie)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	central := auth.NewCentralClientWithInternalAuth("", srv.URL, "internal-secret", nil)
	logger := &fakeLogger{}
	handler := centralLogout(central, logger)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req = req.WithContext(withAuthSession(req.Context(), authSession{
		method:     authMethodCookie,
		credential: "cookie-value",
	}))
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != auth.CentralSessionCookieName || cookies[0].MaxAge != -1 {
		t.Fatalf("expected central cookie clearing response, got %+v", cookies)
	}
}
