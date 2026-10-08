package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
	"project-pn/internal/migrations"
	"project-pn/internal/words"
)

func testUserRouter(t *testing.T) (http.Handler, string) {
	t.Helper()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for user handler HTTP tests")
	}

	ctx := context.Background()
	migrationsPath := "file://" + repoPath(t, "db", "migrations")
	if err := migrations.Up(migrationsPath, databaseURL); err != nil {
		t.Fatalf("up migration: %v", err)
	}

	pool, err := db.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(pool.Close)

	cfg := config.Load()
	authSvc := auth.New(pool, auth.Options{
		DefaultDefinitionLang:  cfg.DefaultDefinitionLang,
		DefaultTargetLang:      cfg.DefaultTargetLang,
		DefaultUILang:          cfg.UILang,
		AllowedDefinitionLangs: cfg.AllowedDefinitionLangs,
		AllowedTargetLangs:     cfg.AllowedTargetLangs,
		AllowedUILangs:         cfg.AllowedUILangs,
		ForceDefinitionLang:    cfg.ForceDefinitionLang,
		ForceTargetLang:        cfg.ForceTargetLang,
		ForceUILang:            cfg.ForceUILang,
	})
	wordsSvc := words.New(pool, enrich.NewOpenAI("", "", ""), admin.NoopLogger{}, learninglog.NoopLogger{}, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	router := NewRouter(Dependencies{
		DB:             pool,
		Words:          wordsSvc,
		Auth:           authSvc,
		CentralAuth:    mockCentralClient(t),
		AllowedOrigins: []string{"http://localhost:8081"},
		AdminLogger:    admin.NoopLogger{},
	})

	emailAddr := uniqueEmail("user-handler")
	token := "token-" + emailAddr
	registerTestToken(token, emailAddr)
	_, err = authSvc.EnsureCentralUser(ctx, auth.SessionFromCentralUser(auth.CentralUser{
		ID:    "central-" + emailAddr,
		Email: emailAddr,
	}, "google"))
	if err != nil {
		t.Fatalf("ensure test central user: %v", err)
	}

	return router, token
}

func TestUserLanguagesEndpoints(t *testing.T) {
	router, token := testUserRouter(t)

	// Add a new language pair.
	addBody := `{"target_language":"zh","display_language":"en","set_active":true}`
	addReq := authRequest(t, http.MethodPost, "/api/user/languages", addBody, token)
	addRec := httptest.NewRecorder()
	router.ServeHTTP(addRec, addReq)
	if addRec.Code != http.StatusCreated {
		t.Fatalf("add language: expected 201, got %d body=%s", addRec.Code, addRec.Body.String())
	}

	// List languages.
	listReq := authRequest(t, http.MethodGet, "/api/user/languages", "", token)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list languages: expected 200, got %d body=%s", listRec.Code, listRec.Body.String())
	}
	var listResp userLanguagesResponse
	if err := json.Unmarshal(listRec.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(listResp.Languages) != 2 {
		t.Fatalf("expected 2 languages, got %d", len(listResp.Languages))
	}

	// Switch active language.
	patchReq := authRequest(t, http.MethodPatch, "/api/user/languages/en/active", "", token)
	patchRec := httptest.NewRecorder()
	router.ServeHTTP(patchRec, patchReq)
	if patchRec.Code != http.StatusNoContent {
		t.Fatalf("set active: expected 204, got %d body=%s", patchRec.Code, patchRec.Body.String())
	}

	// Update display language.
	updateBody := `{"display_language":"ko"}`
	updateReq := authRequest(t, http.MethodPatch, "/api/user/languages/en", updateBody, token)
	updateRec := httptest.NewRecorder()
	router.ServeHTTP(updateRec, updateReq)
	if updateRec.Code != http.StatusNoContent {
		t.Fatalf("update display: expected 204, got %d body=%s", updateRec.Code, updateRec.Body.String())
	}
}

func TestUILanguageEndpoints(t *testing.T) {
	router, token := testUserRouter(t)

	getReq := authRequest(t, http.MethodGet, "/api/user/ui-language", "", token)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get ui language: expected 200, got %d body=%s", getRec.Code, getRec.Body.String())
	}
	var getResp uiLanguageResponse
	if err := json.Unmarshal(getRec.Body.Bytes(), &getResp); err != nil {
		t.Fatalf("decode ui language: %v", err)
	}
	if getResp.UILanguage == "" {
		t.Fatal("expected non-empty ui language")
	}

	putReq := authRequest(t, http.MethodPut, "/api/user/ui-language", `{"ui_language":"ko"}`, token)
	putRec := httptest.NewRecorder()
	router.ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusNoContent {
		t.Fatalf("set ui language: expected 204, got %d body=%s", putRec.Code, putRec.Body.String())
	}
}

func TestUpdateLanguagePairTargetLanguage(t *testing.T) {
	router, token := testUserRouter(t)

	// Change the target language from "en" to "ja", keep display "ko".
	body := `{"new_target_language":"ja","display_language":"ko"}`
	req := authRequest(t, http.MethodPatch, "/api/user/languages/en", body, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("update target language: expected 204, got %d body=%s", rec.Code, rec.Body.String())
	}

	listReq := authRequest(t, http.MethodGet, "/api/user/languages", "", token)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	var listResp userLanguagesResponse
	if err := json.Unmarshal(listRec.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	var jaFound bool
	for _, l := range listResp.Languages {
		if l.TargetLanguage == "en" {
			t.Fatalf("old target language en should no longer exist")
		}
		if l.TargetLanguage == "ja" && l.DisplayLanguage == "ko" {
			jaFound = true
		}
	}
	if !jaFound {
		t.Fatalf("expected ja/ko pair after update, got %+v", listResp.Languages)
	}
}

func TestUpdateLanguagePairNotFound(t *testing.T) {
	router, token := testUserRouter(t)

	body := `{"new_target_language":"fr","display_language":"ko"}`
	req := authRequest(t, http.MethodPatch, "/api/user/languages/xx", body, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("update not-found: expected 404, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestUpdateLanguagePairConflict(t *testing.T) {
	router, token := testUserRouter(t)

	addBody := `{"target_language":"ja","display_language":"ko","set_active":false}`
	addReq := authRequest(t, http.MethodPost, "/api/user/languages", addBody, token)
	addRec := httptest.NewRecorder()
	router.ServeHTTP(addRec, addReq)
	if addRec.Code != http.StatusCreated {
		t.Fatalf("add language: expected 201, got %d body=%s", addRec.Code, addRec.Body.String())
	}

	body := `{"new_target_language":"ja","display_language":"ko"}`
	req := authRequest(t, http.MethodPatch, "/api/user/languages/en", body, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("update conflict: expected 409, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestSetActiveLanguageInvalid(t *testing.T) {
	router, token := testUserRouter(t)

	req := authRequest(t, http.MethodPatch, "/api/user/languages/INVALID/active", "", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("set active invalid: expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestRemoveLanguageInvalid(t *testing.T) {
	router, token := testUserRouter(t)

	req := authRequest(t, http.MethodDelete, "/api/user/languages/INVALID", "", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("remove invalid: expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}
