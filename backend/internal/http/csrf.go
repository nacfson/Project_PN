package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"project-pn/internal/auth"
)

const (
	csrfCookieName = "project_pn_csrf"
	csrfHeaderName = "X-CSRF-Token"
)

func csrfProtection(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, authenticated := authSessionFromContext(r.Context())
			if !authenticated || session.method != authMethodCookie {
				next.ServeHTTP(w, r)
				return
			}

			if _, err := ensureCSRFToken(w, r); err != nil {
				writeError(w, http.StatusInternalServerError, "could not initialize csrf protection")
				return
			}

			if isMutationMethod(r.Method) {
				if !originAllowed(r.Header.Get("Origin"), allowedOrigins) {
					writeError(w, http.StatusForbidden, "csrf origin validation failed")
					return
				}

				cookie, err := r.Cookie(csrfCookieName)
				headerToken := strings.TrimSpace(r.Header.Get(csrfHeaderName))
				if err != nil || cookie.Value == "" || headerToken == "" || cookie.Value != headerToken {
					writeError(w, http.StatusForbidden, "csrf validation failed")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

func ensureCSRFToken(w http.ResponseWriter, r *http.Request) (string, error) {
	if cookie, err := r.Cookie(csrfCookieName); err == nil && strings.TrimSpace(cookie.Value) != "" {
		return cookie.Value, nil
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   24 * 60 * 60,
		Secure:   requestIsSecure(r),
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
	})
	return token, nil
}

func clearCentralSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.CentralSessionCookieName,
		Value:    "",
		Path:     "/",
		Domain:   "nacfson.cloud",
		Expires:  time.Unix(1, 0),
		MaxAge:   -1,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func isMutationMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func originAllowed(origin string, allowedOrigins []string) bool {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" {
		return false
	}
	for _, allowed := range allowedOrigins {
		allowed = strings.TrimRight(strings.TrimSpace(allowed), "/")
		if strings.EqualFold(origin, allowed) {
			return true
		}
	}
	return false
}

func requestIsSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
}
