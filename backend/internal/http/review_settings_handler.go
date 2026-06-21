package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"project-pn/internal/words"
)

type reviewSettingsHandler struct {
	svc *words.Service
}

type patchReviewSettingsRequest struct {
	DesiredRetention *float64 `json:"desired_retention"`
	DailyGoalXP      *int     `json:"daily_goal_xp"`
}

func (h *reviewSettingsHandler) getReviewSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.GetReviewSettings(r.Context(), userIDFromRequest(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *reviewSettingsHandler) patchReviewSettings(w http.ResponseWriter, r *http.Request) {
	var req patchReviewSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.DesiredRetention == nil && req.DailyGoalXP == nil {
		writeError(w, http.StatusBadRequest, "at least one setting is required")
		return
	}

	settings, err := h.svc.UpdateReviewSettings(r.Context(), userIDFromRequest(r), words.UpdateReviewSettingsParams{
		DesiredRetention: req.DesiredRetention,
		DailyGoalXP:      req.DailyGoalXP,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

type streakSettingsHandler struct {
	svc *words.Service
}

type patchStreakSettingsRequest struct {
	VacationModeUntil *string `json:"vacation_mode_until"`
	UseStreakFreeze   *bool   `json:"use_streak_freeze"`
}

func (h *streakSettingsHandler) getStreakSettings(w http.ResponseWriter, r *http.Request) {
	dueToday, err := h.svc.CountDueToday(r.Context(), userIDFromRequest(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	settings, err := h.svc.GetStreakSettings(r.Context(), userIDFromRequest(r), dueToday)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *streakSettingsHandler) patchStreakSettings(w http.ResponseWriter, r *http.Request) {
	var req patchStreakSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.VacationModeUntil == nil && req.UseStreakFreeze == nil {
		writeError(w, http.StatusBadRequest, "at least one setting is required")
		return
	}

	settings, err := h.svc.UpdateStreakSettings(r.Context(), userIDFromRequest(r), words.UpdateStreakSettingsParams{
		VacationModeUntil: req.VacationModeUntil,
		UseStreakFreeze:   req.UseStreakFreeze,
	})
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "words:") {
			writeError(w, http.StatusBadRequest, strings.TrimSpace(strings.TrimPrefix(msg, "words:")))
			return
		}
		writeError(w, http.StatusBadRequest, "invalid streak setting")
		return
	}

	writeJSON(w, http.StatusOK, settings)
}
