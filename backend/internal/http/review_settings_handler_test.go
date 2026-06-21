package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"project-pn/internal/words"
)

func TestReviewSettingsGetAndPatchDailyGoal(t *testing.T) {
	router, token := validationRouter(t)

	getReq := authRequest(t, http.MethodGet, "/api/reviews/settings", "", token)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get settings: expected 200, got %d body=%s", getRec.Code, getRec.Body.String())
	}

	var settings words.ReviewSettings
	if err := json.Unmarshal(getRec.Body.Bytes(), &settings); err != nil {
		t.Fatalf("decode settings: %v", err)
	}
	if settings.DailyGoalXP != 200 {
		t.Fatalf("daily_goal_xp = %d, want 200", settings.DailyGoalXP)
	}

	patchReq := authRequest(t, http.MethodPatch, "/api/reviews/settings", `{"daily_goal_xp":150}`, token)
	patchRec := httptest.NewRecorder()
	router.ServeHTTP(patchRec, patchReq)
	if patchRec.Code != http.StatusOK {
		t.Fatalf("patch settings: expected 200, got %d body=%s", patchRec.Code, patchRec.Body.String())
	}

	if err := json.Unmarshal(patchRec.Body.Bytes(), &settings); err != nil {
		t.Fatalf("decode patched settings: %v", err)
	}
	if settings.DailyGoalXP != 150 {
		t.Fatalf("daily_goal_xp = %d, want 150", settings.DailyGoalXP)
	}
}

func TestStatsSummaryIncludesStreakAndDailyGoal(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodGet, "/api/stats/summary", "", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("stats summary: expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var summary words.StatsSummary
	if err := json.Unmarshal(rec.Body.Bytes(), &summary); err != nil {
		t.Fatalf("decode summary: %v", err)
	}
	if summary.DailyGoalXP != 200 {
		t.Fatalf("daily_goal_xp = %d, want 200", summary.DailyGoalXP)
	}
	if summary.StreakFreezeTokens < 0 {
		t.Fatalf("streak_freeze_tokens = %d", summary.StreakFreezeTokens)
	}
}

func TestStreakSettingsPatchVacationMode(t *testing.T) {
	router, token := validationRouter(t)

	patchReq := authRequest(t, http.MethodPatch, "/api/streaks/settings", `{"vacation_mode_until":"2099-12-31"}`, token)
	patchRec := httptest.NewRecorder()
	router.ServeHTTP(patchRec, patchReq)
	if patchRec.Code != http.StatusOK {
		t.Fatalf("patch streak settings: expected 200, got %d body=%s", patchRec.Code, patchRec.Body.String())
	}

	var settings words.StreakSettings
	if err := json.Unmarshal(patchRec.Body.Bytes(), &settings); err != nil {
		t.Fatalf("decode streak settings: %v", err)
	}
	if !settings.VacationModeActive {
		t.Fatal("expected vacation mode active")
	}

	clearReq := authRequest(t, http.MethodPatch, "/api/streaks/settings", `{"vacation_mode_until":""}`, token)
	clearRec := httptest.NewRecorder()
	router.ServeHTTP(clearRec, clearReq)
	if clearRec.Code != http.StatusOK {
		t.Fatalf("clear vacation: expected 200, got %d body=%s", clearRec.Code, clearRec.Body.String())
	}
	if err := json.Unmarshal(clearRec.Body.Bytes(), &settings); err != nil {
		t.Fatalf("decode cleared settings: %v", err)
	}
	if settings.VacationModeActive {
		t.Fatal("expected vacation mode inactive")
	}
}

func TestReviewSettingsPatchRejectsEmptyBody(t *testing.T) {
	router, token := validationRouter(t)

	req := authRequest(t, http.MethodPatch, "/api/reviews/settings", `{}`, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
