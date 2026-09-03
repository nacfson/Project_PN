package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

type authHandler struct {
	svc    *auth.Service
	logger admin.Logger
}

type linkedProviderResponse struct {
	Provider string    `json:"provider"`
	Email    string    `json:"email"`
	LinkedAt time.Time `json:"linked_at"`
}

type meResponse struct {
	ID                 string                      `json:"id"`
	Email              string                      `json:"email"`
	EmailVerified      bool                        `json:"email_verified"`
	EmailVerifiedAt    *time.Time                  `json:"email_verified_at,omitempty"`
	NativeLanguage     string                      `json:"native_language"`
	TargetLanguage     string                      `json:"target_language"`
	UILanguage         string                      `json:"ui_language"`
	ActiveLanguage     auth.UserLanguage           `json:"active_language"`
	LinkRecommendation *auth.LinkRecommendation    `json:"link_recommendation,omitempty"`
	MergeSuggestion    *auth.MergeSuggestion       `json:"merge_suggestion,omitempty"`
	LinkedProviders    []linkedProviderResponse    `json:"linked_providers,omitempty"`
}

func (h *authHandler) languageOptions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.LanguageOptions())
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type refreshResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

func refreshSessionHandler(central *auth.CentralClient, logger admin.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if central == nil {
			writeError(w, http.StatusInternalServerError, "central auth is not configured")
			return
		}

		var req refreshRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
			writeError(w, http.StatusBadRequest, "refresh_token required")
			return
		}

		session, err := central.RefreshSession(r.Context(), req.RefreshToken)
		if err != nil {
			if errors.Is(err, auth.ErrInvalidToken) {
				logger.Logf("AUTH_FAILURE", "refresh failed from %s: %v", r.RemoteAddr, err)
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		logger.Logf("AUTH", "session refreshed from %s", r.RemoteAddr)
		writeJSON(w, http.StatusOK, refreshResponse{
			Token:        session.Token,
			RefreshToken: session.RefreshToken,
			ExpiresAt:    session.ExpiresAt,
		})
	}
}

func centralLogout(central *auth.CentralClient, logger admin.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if central == nil {
			writeError(w, http.StatusInternalServerError, "central auth is not configured")
			return
		}

		session, ok := authSessionFromContext(r.Context())
		if !ok {
			token := bearerToken(r)
			if token == "" {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			session = authSession{method: authMethodBearer, credential: token}
		}

		var err error
		switch session.method {
		case authMethodCookie:
			err = central.LogoutCookieSession(r.Context(), session.credential)
		case authMethodBearer:
			err = central.Logout(r.Context(), session.credential)
		default:
			err = auth.ErrInvalidToken
		}
		if err != nil {
			logger.Logf("AUTH_FAILURE", "logout failed from %s: %v", r.RemoteAddr, err)
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		if session.method == authMethodCookie {
			clearCentralSessionCookie(w, r)
		}
		logger.Logf("AUTH", "logout from %s", r.RemoteAddr)
		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *authHandler) me(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	authResult, _ := authResultFromContext(r.Context())

	linked, err := h.svc.ListLinkedProviders(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	linkedResp := make([]linkedProviderResponse, 0, len(linked))
	for _, item := range linked {
		linkedResp = append(linkedResp, linkedProviderResponse{
			Provider: item.Provider,
			Email:    item.Email,
			LinkedAt: item.LinkedAt,
		})
	}

	var mergeSuggestion *auth.MergeSuggestion
	suggestions, err := h.svc.MergeSuggestions(r.Context(), user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if len(suggestions) > 0 {
		mergeSuggestion = &suggestions[0]
	}

	h.logger.Logf("AUTH", "%s identity confirmed from %s", user.Email, r.RemoteAddr)
	writeJSON(w, http.StatusOK, meResponse{
		ID:                 user.ID,
		Email:              user.Email,
		EmailVerified:      user.IsEmailVerified(),
		EmailVerifiedAt:    user.EmailVerifiedAt,
		NativeLanguage:     user.NativeLanguage,
		TargetLanguage:     user.TargetLanguage,
		UILanguage:         user.UILanguage,
		ActiveLanguage:     user.ActiveLanguage,
		LinkRecommendation: authResult.LinkRecommendation,
		MergeSuggestion:    mergeSuggestion,
		LinkedProviders:    linkedResp,
	})
}

func (h *authHandler) linkedProviders(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	linked, err := h.svc.ListLinkedProviders(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	resp := make([]linkedProviderResponse, 0, len(linked))
	for _, item := range linked {
		resp = append(resp, linkedProviderResponse{
			Provider: item.Provider,
			Email:    item.Email,
			LinkedAt: item.LinkedAt,
		})
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *authHandler) linkProvider(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	authResult, ok := authResultFromContext(r.Context())
	if !ok || authResult.PendingIdentity == nil {
		writeError(w, http.StatusBadRequest, "no link recommendation available")
		return
	}
	if err := h.svc.LinkProvider(r.Context(), user.ID, *authResult.PendingIdentity); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type mergeRequestBody struct {
	SourceUserID string `json:"source_user_id"`
}

func (h *authHandler) createMergeRequest(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body mergeRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.SourceUserID) == "" {
		writeError(w, http.StatusBadRequest, "source_user_id required")
		return
	}
	requestID, err := h.svc.CreateMergeRequest(r.Context(), user.ID, body.SourceUserID, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": requestID})
}

func (h *authHandler) confirmMergeRequest(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		writeError(w, http.StatusBadRequest, "id required")
		return
	}
	if err := h.svc.ConfirmMergeRequest(r.Context(), user.ID, requestID); err != nil {
		if errors.Is(err, auth.ErrInvalidToken) {
			writeError(w, http.StatusBadRequest, "invalid merge request")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *authHandler) mergeSuggestions(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	suggestions, err := h.svc.MergeSuggestions(r.Context(), user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, suggestions)
}
