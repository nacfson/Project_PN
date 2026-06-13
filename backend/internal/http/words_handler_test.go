package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"project-pn/internal/words"
)

// router wired with a words service whose pool is never touched by the
// validation paths under test.
func validationRouter() http.Handler {
	svc := words.New(nil, nil, "00000000-0000-0000-0000-000000000001", "en", "ko")
	return NewRouter(Dependencies{Words: svc})
}

func TestLookupRejectsForceWithoutPosOrWordID(t *testing.T) {
	t.Parallel()

	body := strings.NewReader(`{"text":"charge","force":true,"part_of_speech":"Any"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/words/lookup", body)
	rec := httptest.NewRecorder()

	validationRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d for force+Any+no word_id, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestLookupRejectsEmptyText(t *testing.T) {
	t.Parallel()

	body := strings.NewReader(`{"text":"  "}`)
	req := httptest.NewRequest(http.MethodPost, "/api/words/lookup", body)
	rec := httptest.NewRecorder()

	validationRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d for empty text, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestAddLearningItemRequiresWordSenseID(t *testing.T) {
	t.Parallel()

	body := strings.NewReader(`{}`)
	req := httptest.NewRequest(http.MethodPost, "/api/learning-items", body)
	rec := httptest.NewRecorder()

	validationRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected %d for missing word_sense_id, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestCorsPreflightAllowsConfiguredOrigin(t *testing.T) {
	t.Parallel()

	svc := words.New(nil, nil, "00000000-0000-0000-0000-000000000001", "en", "ko")
	router := NewRouter(Dependencies{Words: svc, AllowedOrigins: []string{"http://localhost:8081"}})

	req := httptest.NewRequest(http.MethodOptions, "/api/words/lookup", nil)
	req.Header.Set("Origin", "http://localhost:8081")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:8081" {
		t.Fatalf("expected allow-origin header for configured origin, got %q", got)
	}
}

func TestApiRoutesAbsentWithoutWordsService(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodPost, "/api/words/lookup", strings.NewReader(`{"text":"x"}`))
	rec := httptest.NewRecorder()

	NewRouter(Dependencies{}).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected %d when words service is absent, got %d", http.StatusNotFound, rec.Code)
	}
}
