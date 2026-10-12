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
				writeCodedError(w, http.StatusInternalServerError, "SEC-599", "could not initialize csrf protection", true)
				return
			}

			if isMutationMethod(r.Method) {
				if !originAllowed(r.Header.Get("Origin"), allowedOrigins) {
					writeCodedError(w, http.StatusForbidden, "SEC-101", "csrf origin validation failed", false)
					return
				}

				cookie, err := r.Cookie(csrfCookieName)
				headerToken := strings.TrimSpace(r.Header.Get(csrfHeaderName))
				if err != nil || cookie.Value == "" || headerToken == "" || cookie.Value != headerToken {
					writeCodedError(w, http.StatusForbidden, "SEC-102", "csrf validation failed", true)
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

// requestIsSecure reports whether the visitor reached us over HTTPS.
// TLS terminates at platform Traefik (spec 008), so r.TLS is nil in production
// and the original scheme arrives in X-Forwarded-Proto. Trusting the header is
// safe because the proj-pn NetworkPolicy admits only the platform namespace and
// pn-frontend, and Traefik overwrites client-supplied forwarded headers.
// Never redirect to HTTPS here: Traefik already does it, and the app sees
// plain http on the wire, so an app-side redirect would loop.
func requestIsSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
}
