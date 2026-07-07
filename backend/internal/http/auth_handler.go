package httpapi

import (
	"net/http"
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

func centralLogout(central *auth.CentralClient, logger admin.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if central == nil {
			writeError(w, http.StatusInternalServerError, "central auth is not configured")
			return
		}
		token := bearerToken(r)
		if err := central.Logout(r.Context(), token); err != nil {
			logger.Logf("AUTH_FAILURE", "logout failed for token from %s: %v", r.RemoteAddr, err)
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
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
