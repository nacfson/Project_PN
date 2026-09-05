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
	EnsureCentralUser(ctx context.Context, session auth.CentralSession) (auth.AuthResult, error)
}

func authMiddleware(svc centralUserEnsurer, central *auth.CentralClient, logger admin.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			discardClientIdentityHeaders(r)

			var (
				session     auth.CentralSession
				credentials authSession
				err         error
			)
			if cookie, cookieErr := r.Cookie(auth.CentralSessionCookieName); cookieErr == nil {
				if central == nil {
					writeCodedError(w, http.StatusInternalServerError, "AUTH-102", "central auth is not configured", false)
					return
				}
				session, err = central.ValidateCookieSession(r.Context(), cookie.Value)
				credentials = authSession{
					method:     authMethodCookie,
					credential: cookie.Value,
				}
				if err != nil {
					if errors.Is(err, auth.ErrInternalAuthNotConfigured) {
						logger.Logf("AUTH_FAILURE", "cookie session validation is not configured from %s: %v", r.RemoteAddr, err)
						writeCodedError(w, http.StatusInternalServerError, "AUTH-102", "central auth is not configured", false)
						return
					}
					logger.Logf("AUTH_FAILURE", "cookie session validation failed from %s: %v", r.RemoteAddr, err)
					clearCentralSessionCookie(w, r)
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
					return
				}
			} else {
				token := bearerToken(r)
				if token == "" {
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
					return
				}
				if central == nil {
					writeCodedError(w, http.StatusInternalServerError, "AUTH-102", "central auth is not configured", false)
					return
				}
				session, err = central.ValidateSession(r.Context(), token)
				credentials = authSession{
					method:     authMethodBearer,
					credential: token,
				}
				if err != nil {
					logger.Logf("AUTH_FAILURE", "session validation failed from %s: %v", r.RemoteAddr, err)
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
					return
				}
			}

			authResult, err := svc.EnsureCentralUser(r.Context(), session)
			if err != nil {
				writeCodedError(w, http.StatusInternalServerError, "AUTH-599", "internal error", true)
				return
			}
			ctx := withAuthSession(r.Context(), credentials)
			ctx = withAuthResult(ctx, authResult)
			next.ServeHTTP(w, r.WithContext(withUser(ctx, authResult.User)))
		})
	}
}

// optionalAuthMiddleware preserves anonymous analytics delivery while attaching
// an API-verified actor whenever a browser cookie or bearer credential exists.
func optionalAuthMiddleware(svc centralUserEnsurer, central *auth.CentralClient, logger admin.Logger) func(http.Handler) http.Handler {
	required := authMiddleware(svc, central, logger)
	return func(next http.Handler) http.Handler {
		protected := required(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bearerToken(r) != "" {
				protected.ServeHTTP(w, r)
				return
			}
			if _, err := r.Cookie(auth.CentralSessionCookieName); err == nil {
				protected.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
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
				writeCodedError(w, http.StatusForbidden, "AUTH-201", "email verification required", false)
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
