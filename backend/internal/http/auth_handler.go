package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"time"

	"project-pn/internal/auth"
)

type authHandler struct {
	svc *auth.Service
}

type registerRequest struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	NativeLanguage string `json:"native_language"`
	TargetLanguage string `json:"target_language"`
	UILanguage     string `json:"ui_language"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type verifyEmailRequest struct {
	Email string `json:"email"`
}

type sessionResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
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

type emailNotVerifiedResponse struct {
	Error string `json:"error"`
	Email string `json:"email"`
}

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if err := h.svc.Register(r.Context(), req.Email, req.Password, req.NativeLanguage, req.TargetLanguage, req.UILanguage); err != nil {
		h.writeAuthError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *authHandler) languageOptions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.LanguageOptions())
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	session, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, auth.ErrEmailNotVerified) {
			writeJSON(w, http.StatusForbidden, emailNotVerifiedResponse{
				Error: "email_not_verified",
				Email: auth.NormalizeEmail(req.Email),
			})
			return
		}
		h.writeAuthError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionResponse{Token: session.Token, ExpiresAt: session.ExpiresAt})
}

func (h *authHandler) logout(w http.ResponseWriter, r *http.Request) {
	token := bearerToken(r)
	if err := h.svc.Logout(r.Context(), token); err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func centralLogout(central *auth.CentralClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if central == nil {
			writeError(w, http.StatusInternalServerError, "central auth is not configured")
			return
		}
		token := bearerToken(r)
		if err := central.Logout(r.Context(), token); err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *authHandler) me(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
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

func (h *authHandler) requestVerificationEmail(w http.ResponseWriter, r *http.Request) {
	var req verifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	_ = h.svc.SendVerificationEmail(r.Context(), req.Email)
	w.WriteHeader(http.StatusNoContent)
}

func (h *authHandler) verifyEmail(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	emailAddr, err := h.svc.ConsumeVerificationToken(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired link")
		return
	}

	redirectBase := h.svc.WebAppPublicURL()
	redirectURL := redirectBase
	if redirectBase == "" {
		redirectURL = "/"
	}
	redirectURL = redirectBase + "/?verified=true&email=" + url.QueryEscape(emailAddr)
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func (h *authHandler) writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrEmailTaken):
		writeError(w, http.StatusConflict, "email already registered")
	case errors.Is(err, auth.ErrWeakPassword):
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
	case errors.Is(err, auth.ErrEmailRequired):
		writeError(w, http.StatusBadRequest, "email is required")
	case errors.Is(err, auth.ErrInvalidTargetLang):
		writeError(w, http.StatusBadRequest, "invalid target language")
	case errors.Is(err, auth.ErrInvalidDefinitionLang):
		writeError(w, http.StatusBadRequest, "invalid definition language")
	case errors.Is(err, auth.ErrInvalidCredentials):
		writeError(w, http.StatusUnauthorized, "invalid credentials")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}
