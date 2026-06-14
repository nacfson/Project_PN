package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"project-pn/internal/auth"
)

type authHandler struct {
	svc             *auth.Service
	oauthVerifiers  map[string]auth.OAuthVerifier
}

type registerRequest struct {
	Email          string `json:"email"`
	Password       string `json:"password"`
	NativeLanguage string `json:"native_language"`
	TargetLanguage string `json:"target_language"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type magicLinkRequest struct {
	Email string `json:"email"`
}

type exchangeRequest struct {
	Code string `json:"code"`
}

type oauthRequest struct {
	IDToken string `json:"id_token"`
}

type sessionResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

type meResponse struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	EmailVerified   bool       `json:"email_verified"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	NativeLanguage  string     `json:"native_language"`
	TargetLanguage  string     `json:"target_language"`
}

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	session, err := h.svc.Register(r.Context(), req.Email, req.Password, req.NativeLanguage, req.TargetLanguage)
	if err != nil {
		h.writeAuthError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionResponse{Token: session.Token, ExpiresAt: session.ExpiresAt})
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
	})
}

func (h *authHandler) magicLink(w http.ResponseWriter, r *http.Request) {
	var req magicLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	_ = h.svc.SendMagicLink(r.Context(), req.Email)
	w.WriteHeader(http.StatusNoContent)
}

func (h *authHandler) magicConsume(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	code, err := h.svc.ConsumeMagicLink(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired link")
		return
	}

	callbackBase := strings.TrimRight(h.svc.AppPublicURL(), "/")
	redirectURL := callbackBase + "/auth/callback#code=" + url.QueryEscape(code)
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func (h *authHandler) magicExchange(w http.ResponseWriter, r *http.Request) {
	var req exchangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	session, err := h.svc.ExchangeMagicCode(r.Context(), req.Code)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired code")
		return
	}
	writeJSON(w, http.StatusOK, sessionResponse{Token: session.Token, ExpiresAt: session.ExpiresAt})
}

func (h *authHandler) oauthLogin(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	verifier, ok := h.oauthVerifiers[provider]
	if !ok {
		writeError(w, http.StatusNotFound, "unsupported provider")
		return
	}

	var req oauthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	claims, err := verifier.Verify(r.Context(), strings.TrimSpace(req.IDToken))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	session, err := h.svc.LoginWithOAuth(r.Context(), provider, claims.Subject, claims.Email, claims.EmailVerified)
	if err != nil {
		h.writeOAuthError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionResponse{Token: session.Token, ExpiresAt: session.ExpiresAt})
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

func (h *authHandler) writeOAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrOAuthInvalid), errors.Is(err, auth.ErrOAuthCannotLink):
		writeError(w, http.StatusUnauthorized, "invalid credentials")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}
