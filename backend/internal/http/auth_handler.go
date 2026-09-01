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

type meResponse struct {
	ID              string            `json:"id"`
	Email           string            `json:"email"`
	EmailVerified   bool              `json:"email_verified"`
	EmailVerifiedAt *time.Time        `json:"email_verified_at,omitempty"`
	NativeLanguage  string            `json:"native_language"`
	TargetLanguage  string            `json:"target_language"`
	UILanguage      string            `json:"ui_language"`
	ActiveLanguage  auth.UserLanguage `json:"active_language"`
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
	h.logger.Logf("AUTH", "%s identity confirmed from %s", user.Email, r.RemoteAddr)
	writeJSON(w, http.StatusOK, meResponse{
		ID:              user.ID,
		Email:           user.Email,
		EmailVerified:   user.IsEmailVerified(),
		EmailVerifiedAt: user.EmailVerifiedAt,
		NativeLanguage:  user.NativeLanguage,
		TargetLanguage:  user.TargetLanguage,
		UILanguage:      user.UILanguage,
		ActiveLanguage:  user.ActiveLanguage,
	})
}
