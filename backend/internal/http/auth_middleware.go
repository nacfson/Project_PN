package httpapi

import (
	"net/http"
	"strings"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

func authMiddleware(svc *auth.Service, central *auth.CentralClient, logger admin.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r)
			if token == "" {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if central == nil {
				writeError(w, http.StatusInternalServerError, "central auth is not configured")
				return
			}
			session, err := central.ValidateSession(r.Context(), token)
			if err != nil {
				logger.Logf("AUTH_FAILURE", "session validation failed from %s: %v", r.RemoteAddr, err)
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			user, err := svc.EnsureCentralUser(r.Context(), session.User)
			if err != nil {
				writeInternalError(w, r, err)
				return
			}
			next.ServeHTTP(w, r.WithContext(withUser(r.Context(), user)))
		})
	}
}

func requireVerified(logger admin.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := userFromContext(r.Context())
			if !ok || !user.IsEmailVerified() {
				if ok {
					logger.Logf("VERIFY_REQUIRED", "%s requested %s %s but email is not verified", user.Email, r.Method, r.URL.Path)
				}
				writeError(w, http.StatusForbidden, "email verification required")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func bearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(header[7:])
}
