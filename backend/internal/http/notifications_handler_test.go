package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRegisterPushTokenValidation(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodPost, "/api/notifications/register", `{"token":"","platform":"ios"}`, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestRegisterPushTokenSuccess(t *testing.T) {
	router, token := validationRouter(t)

	body := `{"token":"ExponentPushToken[test-token]","platform":"ios"}`
	req := authRequest(t, http.MethodPost, "/api/notifications/register", body, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"registered":true`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestWordOfTheDayEndpoint(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodGet, "/api/content/word-of-the-day", "", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"date"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestContentChallengesEndpoint(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodGet, "/api/content/challenges", "", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"challenges"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}
