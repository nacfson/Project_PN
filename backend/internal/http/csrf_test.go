package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"project-pn/internal/auth"
)

func cookieAuthRequest(method, path string) *http.Request {
	req := httptest.NewRequest(method, path, nil)
	ctx := withAuthSession(req.Context(), authSession{
		method:     authMethodCookie,
		credential: "cookie-value",
	})
	return req.WithContext(ctx)
}

func TestCSRFProtectionSetsHostOnlyCookie(t *testing.T) {
	req := cookieAuthRequest(http.MethodGet, "/api/auth/me")
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()

	csrfProtection([]string{"https://pn.nacfson.cloud"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one csrf cookie, got %d", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != csrfCookieName || cookie.Value == "" {
		t.Fatalf("unexpected csrf cookie: %+v", cookie)
	}
	if cookie.Domain != "" {
		t.Fatalf("csrf cookie must be host-only, got domain %q", cookie.Domain)
	}
	if !cookie.Secure || cookie.HttpOnly {
		t.Fatalf("csrf cookie flags are unsafe: secure=%v httponly=%v", cookie.Secure, cookie.HttpOnly)
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("expected SameSite=Lax, got %v", cookie.SameSite)
	}
}

func TestCSRFProtectionRejectsInvalidOriginAndToken(t *testing.T) {
	tests := []struct {
		name       string
		origin     string
		header     string
		cookie     string
		wantStatus int
		wantCode   string
	}{
		{name: "missing origin", header: "csrf", cookie: "csrf", wantStatus: http.StatusForbidden, wantCode: "SEC-101"},
		{name: "untrusted origin", origin: "https://attacker.example", header: "csrf", cookie: "csrf", wantStatus: http.StatusForbidden, wantCode: "SEC-101"},
		{name: "missing token header", origin: "https://pn.nacfson.cloud", cookie: "csrf", wantStatus: http.StatusForbidden, wantCode: "SEC-102"},
		{name: "mismatched token", origin: "https://pn.nacfson.cloud", header: "wrong", cookie: "csrf", wantStatus: http.StatusForbidden, wantCode: "SEC-102"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := cookieAuthRequest(http.MethodPost, "/api/learning-items")
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			if tt.header != "" {
				req.Header.Set(csrfHeaderName, tt.header)
			}
			req.AddCookie(&http.Cookie{Name: csrfCookieName, Value: tt.cookie})
			rec := httptest.NewRecorder()

			csrfProtection([]string{"https://pn.nacfson.cloud"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				t.Fatal("next handler must not be called")
			})).ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("expected %d, got %d", tt.wantStatus, rec.Code)
			}
			var response struct {
				Code string `json:"code"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if response.Code != tt.wantCode {
				t.Fatalf("expected %s, got %q", tt.wantCode, response.Code)
			}
		})
	}
}

func TestCSRFProtectionAcceptsValidBrowserMutation(t *testing.T) {
	req := cookieAuthRequest(http.MethodPatch, "/api/user/ui-language")
	req.Header.Set("Origin", "https://pn.nacfson.cloud")
	req.Header.Set(csrfHeaderName, "csrf-token")
	req.AddCookie(&http.Cookie{Name: csrfCookieName, Value: "csrf-token"})
	rec := httptest.NewRecorder()

	nextCalled := false
	csrfProtection([]string{"https://pn.nacfson.cloud"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusNoContent)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent || !nextCalled {
		t.Fatalf("expected valid csrf request to pass, code=%d next=%v", rec.Code, nextCalled)
	}
}

func TestCSRFProtectionDoesNotGateNativeBearerMutation(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/learning-items", nil)
	req = req.WithContext(withAuthSession(req.Context(), authSession{
		method:     authMethodBearer,
		credential: "native-token",
	}))
	rec := httptest.NewRecorder()

	csrfProtection(nil)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected bearer mutation to pass without browser csrf, got %d", rec.Code)
	}
}

func TestClearCentralSessionCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	clearCentralSessionCookie(rec, httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil))

	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one clearing cookie, got %d", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != auth.CentralSessionCookieName || cookie.Domain != "nacfson.cloud" || cookie.MaxAge != -1 {
		t.Fatalf("unexpected clearing cookie: %+v", cookie)
	}
}
