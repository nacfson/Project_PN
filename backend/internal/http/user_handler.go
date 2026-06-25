package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"project-pn/internal/auth"
)

type userHandler struct {
	svc *auth.Service
}

type userLanguagesResponse struct {
	Languages []auth.UserLanguage `json:"languages"`
}

type addUserLanguageRequest struct {
	TargetLanguage  string `json:"target_language"`
	DisplayLanguage string `json:"display_language"`
	SetActive       bool   `json:"set_active"`
}

type updateDisplayLanguageRequest struct {
	DisplayLanguage string `json:"display_language"`
}

type uiLanguageResponse struct {
	UILanguage string `json:"ui_language"`
}

type setUILanguageRequest struct {
	UILanguage string `json:"ui_language"`
}

func (h *userHandler) listLanguages(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	langs, err := h.svc.GetUserLanguages(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if langs == nil {
		langs = []auth.UserLanguage{}
	}
	writeJSON(w, http.StatusOK, userLanguagesResponse{Languages: langs})
}

func (h *userHandler) addLanguage(w http.ResponseWriter, r *http.Request) {
	var req addUserLanguageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.TargetLanguage == "" {
		writeError(w, http.StatusBadRequest, "target_language is required")
		return
	}
	if req.DisplayLanguage == "" {
		writeError(w, http.StatusBadRequest, "display_language is required")
		return
	}

	ul, err := h.svc.AddUserLanguage(r.Context(), userIDFromRequest(r), req.TargetLanguage, req.DisplayLanguage, req.SetActive)
	if err != nil {
		h.writeUserError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, ul)
}

func (h *userHandler) updateDisplayLanguage(w http.ResponseWriter, r *http.Request) {
	targetLang := chi.URLParam(r, "target_language")
	if targetLang == "" {
		writeError(w, http.StatusBadRequest, "target_language is required")
		return
	}

	var req updateDisplayLanguageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.DisplayLanguage == "" {
		writeError(w, http.StatusBadRequest, "display_language is required")
		return
	}

	if err := h.svc.UpdateUserLanguageDisplayLang(r.Context(), userIDFromRequest(r), targetLang, req.DisplayLanguage); err != nil {
		h.writeUserError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *userHandler) setActiveLanguage(w http.ResponseWriter, r *http.Request) {
	targetLang := chi.URLParam(r, "target_language")
	if targetLang == "" {
		writeError(w, http.StatusBadRequest, "target_language is required")
		return
	}

	if err := h.svc.SetActiveUserLanguage(r.Context(), userIDFromRequest(r), targetLang); err != nil {
		h.writeUserError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *userHandler) removeLanguage(w http.ResponseWriter, r *http.Request) {
	targetLang := chi.URLParam(r, "target_language")
	if targetLang == "" {
		writeError(w, http.StatusBadRequest, "target_language is required")
		return
	}

	if err := h.svc.RemoveUserLanguage(r.Context(), userIDFromRequest(r), targetLang); err != nil {
		h.writeUserError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *userHandler) getUILanguage(w http.ResponseWriter, r *http.Request) {
	lang, err := h.svc.GetUILanguage(r.Context(), userIDFromRequest(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, uiLanguageResponse{UILanguage: lang})
}

func (h *userHandler) setUILanguage(w http.ResponseWriter, r *http.Request) {
	var req setUILanguageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.UILanguage == "" {
		writeError(w, http.StatusBadRequest, "ui_language is required")
		return
	}

	if err := h.svc.SetUILanguage(r.Context(), userIDFromRequest(r), req.UILanguage); err != nil {
		h.writeUserError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *userHandler) writeUserError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidTargetLang):
		writeError(w, http.StatusBadRequest, "invalid target language")
	case errors.Is(err, auth.ErrInvalidDefinitionLang):
		writeError(w, http.StatusBadRequest, "invalid display language")
	case errors.Is(err, auth.ErrInvalidUILang):
		writeError(w, http.StatusBadRequest, "invalid ui language")
	case errors.Is(err, auth.ErrLanguageNotFound):
		writeError(w, http.StatusNotFound, "language not found")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}
