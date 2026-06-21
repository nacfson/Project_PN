package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"project-pn/internal/words"
)

type notificationsHandler struct {
	svc *words.Service
}

type registerPushTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

func (h *notificationsHandler) registerPushToken(w http.ResponseWriter, r *http.Request) {
	var req registerPushTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	err := h.svc.RegisterPushToken(r.Context(), userIDFromRequest(r), words.PushTokenRegistration{
		Token:    req.Token,
		Platform: req.Platform,
	})
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "words:") {
			writeError(w, http.StatusBadRequest, strings.TrimSpace(strings.TrimPrefix(msg, "words:")))
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"registered": true})
}

type contentHandler struct {
	svc *words.Service
}

func (h *contentHandler) getWordOfTheDay(w http.ResponseWriter, r *http.Request) {
	langCode := r.URL.Query().Get("language_code")
	defLangCode := r.URL.Query().Get("definition_language_code")

	word, err := h.svc.GetWordOfTheDay(r.Context(), userIDFromRequest(r), langCode, defLangCode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if word.SenseOptions == nil {
		word.SenseOptions = []words.SenseOption{}
	}
	writeJSON(w, http.StatusOK, word)
}

func (h *contentHandler) listChallenges(w http.ResponseWriter, r *http.Request) {
	challenges := h.svc.ListContentChallenges(r.Context(), userIDFromRequest(r))
	if challenges == nil {
		challenges = []words.ContentChallenge{}
	}
	writeJSON(w, http.StatusOK, map[string][]words.ContentChallenge{"challenges": challenges})
}
