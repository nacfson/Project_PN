package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/nacfson/central-auth/internal/config"
	"github.com/nacfson/central-auth/internal/session"
)

const sessionCookieName = "nacfson_session"

type Server struct {
	sessions *session.Service
	cfg      config.Config
}

func NewRouter(sessions *session.Service, cfg config.Config) http.Handler {
	s := &Server{sessions: sessions, cfg: cfg}
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Post("/api/auth/magic-link", s.sendMagicLink)
	r.Get("/auth/callback", s.completeMagicLink)

	r.Get("/api/auth/session", s.getSession)
	r.Delete("/api/auth/session", s.deleteSession)
	r.Post("/api/auth/refresh", s.refreshSession)
	r.Get("/api/internal/cookie-session", s.getCookieSession)

	return r
}

type magicLinkRequest struct {
	Email string `json:"email"`
}

func (s *Server) sendMagicLink(w http.ResponseWriter, r *http.Request) {
	var req magicLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Email) == "" {
		writeError(w, http.StatusBadRequest, "email required")
		return
	}
	raw, err := s.sessions.CreateMagicLink(r.Context(), req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create magic link")
		return
	}
	if s.cfg.DevLogMagicLinks {
		callback := absoluteURL(r, "/auth/callback?token="+url.QueryEscape(raw))
		slog.Info("magic link created", "email", strings.ToLower(req.Email), "url", callback)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

func (s *Server) completeMagicLink(w http.ResponseWriter, r *http.Request) {
	rawToken := strings.TrimSpace(r.URL.Query().Get("token"))
	redirectURL := strings.TrimSpace(r.URL.Query().Get("rd"))
	if rawToken == "" {
		writeError(w, http.StatusBadRequest, "token required")
		return
	}
	issueCookie := shouldIssueCookie(redirectURL)
	creds, _, err := s.sessions.CompleteMagicLink(r.Context(), rawToken, issueCookie)
	if err != nil {
		if errors.Is(err, session.ErrInvalidToken) {
			writeError(w, http.StatusUnauthorized, "invalid magic link")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not complete magic link")
		return
	}
	target, err := buildRedirectURL(redirectURL, creds, issueCookie)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid redirect")
		return
	}
	if issueCookie && creds.CookieValue != "" {
		setSessionCookie(w, s.cfg.CookieDomain, creds.CookieValue, s.cfg.SessionMaxAge)
	}
	http.Redirect(w, r, target, http.StatusFound)
}

func (s *Server) getSession(w http.ResponseWriter, r *http.Request) {
	accessToken := bearerToken(r)
	if accessToken == "" {
		writeError(w, http.StatusUnauthorized, "missing session credentials")
		return
	}
	sess, err := s.sessions.ValidateAccess(r.Context(), accessToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	writeJSON(w, http.StatusOK, sessionResponse(sess))
}

func (s *Server) deleteSession(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil && strings.TrimSpace(cookie.Value) != "" {
		_ = s.sessions.RevokeCookie(r.Context(), cookie.Value)
		clearSessionCookie(w, s.cfg.CookieDomain)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	accessToken := bearerToken(r)
	if accessToken == "" {
		writeError(w, http.StatusUnauthorized, "missing session credentials")
		return
	}
	if err := s.sessions.RevokeAccess(r.Context(), accessToken); err != nil {
		writeError(w, http.StatusInternalServerError, "could not revoke session")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) refreshSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		writeError(w, http.StatusBadRequest, "refresh_token required")
		return
	}
	creds, err := s.sessions.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, session.ErrInvalidToken) {
			writeError(w, http.StatusUnauthorized, "invalid session")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not refresh session")
		return
	}
	writeJSON(w, http.StatusOK, refreshResponse(creds))
}

func (s *Server) getCookieSession(w http.ResponseWriter, r *http.Request) {
	if s.cfg.SessionInternalToken == "" || bearerToken(r) != s.cfg.SessionInternalToken {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	sess, err := s.sessions.ValidateCookie(r.Context(), cookie.Value)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	writeJSON(w, http.StatusOK, cookieSessionResponse(sess))
}

func sessionResponse(sess session.Session) map[string]any {
	return map[string]any{
		"expires_at": sess.AccessExpiresAt.UTC().Format(time.RFC3339),
		"user": map[string]any{
			"id":       sess.User.ID,
			"email":    sess.User.Email,
			"is_admin": sess.User.IsAdmin,
		},
	}
}

func cookieSessionResponse(sess session.Session) map[string]any {
	return map[string]any{
		"user_id":    sess.User.ID,
		"email":      sess.User.Email,
		"is_admin":   sess.User.IsAdmin,
		"expires_at": sess.AccessExpiresAt.UTC().Format(time.RFC3339),
	}
}

func refreshResponse(creds session.Credentials) map[string]any {
	return map[string]any{
		"token":         creds.AccessToken,
		"refresh_token": creds.RefreshToken,
		"expires_at":    creds.ExpiresAt.UTC().Format(time.RFC3339),
	}
}

func bearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(header[7:])
}

func shouldIssueCookie(redirectURL string) bool {
	redirectURL = strings.TrimSpace(redirectURL)
	if redirectURL == "" {
		return true
	}
	parsed, err := url.Parse(redirectURL)
	if err != nil {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

func buildRedirectURL(redirectURL string, creds session.Credentials, issueCookie bool) (string, error) {
	if strings.TrimSpace(redirectURL) == "" {
		redirectURL = "/"
	}
	parsed, err := url.Parse(redirectURL)
	if err != nil {
		return "", err
	}
	if issueCookie {
		return parsed.String(), nil
	}
	query := parsed.Query()
	query.Set("token", creds.AccessToken)
	query.Set("refresh_token", creds.RefreshToken)
	query.Set("expires_at", creds.ExpiresAt.UTC().Format(time.RFC3339))
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func setSessionCookie(w http.ResponseWriter, domain, value string, maxAge time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    value,
		Path:     "/",
		Domain:   domain,
		MaxAge:   int(maxAge.Seconds()),
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearSessionCookie(w http.ResponseWriter, domain string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		Domain:   domain,
		MaxAge:   -1,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func absoluteURL(r *http.Request, path string) string {
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	return scheme + "://" + r.Host + path
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
