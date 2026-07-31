package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

type centralUserEnsurer interface {
	EnsureCentralUser(ctx context.Context, central auth.CentralUser) (auth.User, error)
}

func authMiddleware(svc centralUserEnsurer, central *auth.CentralClient, logger admin.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			discardClientIdentityHeaders(r)

			var (
				session     auth.CentralSession
				authSession authSession
				err         error
			)
			if cookie, cookieErr := r.Cookie(auth.CentralSessionCookieName); cookieErr == nil {
				if central == nil {
					writeError(w, http.StatusInternalServerError, "central auth is not configured")
					return
				}
				session, err = central.ValidateCookieSession(r.Context(), cookie.Value)
				authSession = authSession{
					method:     authMethodCookie,
					credential: cookie.Value,
				}
				if err != nil {
					if errors.Is(err, auth.ErrInternalAuthNotConfigured) {
						logger.Logf("AUTH_FAILURE", "cookie session validation is not configured from %s: %v", r.RemoteAddr, err)
						writeError(w, http.StatusInternalServerError, "central auth is not configured")
						return
					}
					logger.Logf("AUTH_FAILURE", "cookie session validation failed from %s: %v", r.RemoteAddr, err)
					clearCentralSessionCookie(w, r)
					writeError(w, http.StatusUnauthorized, "unauthorized")
					return
				}
			} else {
				token := bearerToken(r)
				if token == "" {
					writeError(w, http.StatusUnauthorized, "unauthorized")
					return
				}
				if central == nil {
					writeError(w, http.StatusInternalServerError, "central auth is not configured")
					return
				}
				session, err = central.ValidateSession(r.Context(), token)
				authSession = authSession{
					method:     authMethodBearer,
					credential: token,
				}
				if err != nil {
					logger.Logf("AUTH_FAILURE", "session validation failed from %s: %v", r.RemoteAddr, err)
					writeError(w, http.StatusUnauthorized, "unauthorized")
					return
				}
			}

			user, err := svc.EnsureCentralUser(r.Context(), session.User)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			ctx := withAuthSession(r.Context(), authSession)
			next.ServeHTTP(w, r.WithContext(withUser(ctx, user)))
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

func discardClientIdentityHeaders(r *http.Request) {
	r.Header.Del("X-User-Id")
	r.Header.Del("X-User-Email")
	r.Header.Del("X-User-Roles")
}
