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

type platformIdentityEnsurer interface {
	EnsurePlatformIdentity(ctx context.Context, identity auth.ConfirmedIdentity) (auth.User, error)
}

func authMiddleware(svc centralUserEnsurer, central *auth.CentralClient, gateway *auth.GatewayClient, logger admin.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			discardClientIdentityHeaders(r)
			if gateway != nil {
				// Clear any client-supplied Authorization, X-User-Subject, and X-User-Issuer before making that decision.
				r.Header.Del("Authorization")
				r.Header.Del("X-User-Subject")
				r.Header.Del("X-User-Issuer")
			}

			// 1. Gateway session confirmation for signIn: shared
			if gateway != nil && gateway.SignInMode() == auth.SignInShared {
				if len(r.Cookies()) > 0 {
					ident, err := gateway.ConfirmIdentity(r.Context(), r.Host, r.Cookies())
					if err != nil {
						logger.Logf("AUTH_FAILURE", "gateway confirmation error from %s: %v", r.RemoteAddr, err)
						writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
						return
					}
					if ident != nil {
						if pEnsurer, ok := svc.(platformIdentityEnsurer); ok {
							user, err := pEnsurer.EnsurePlatformIdentity(r.Context(), *ident)
							if err != nil {
								logger.Logf("AUTH_FAILURE", "ensure platform identity error: %v", err)
								writeCodedError(w, http.StatusInternalServerError, "AUTH-599", "internal error", true)
								return
							}
							ctx := withUser(r.Context(), user)
							next.ServeHTTP(w, r.WithContext(ctx))
							return
						}
					}
				}
			}

			// A project with signIn omitted or none must not start sign-in, must not call the gateway,
			// and must not treat a presented claim as a user.
			if gateway != nil && gateway.SignInMode() != auth.SignInShared {
				writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
				return
			}

			// 2. Fallback to legacy CentralClient (local dev, native bearer clients, tests)
			var (
				session     auth.CentralSession
				credentials authSession
				err         error
			)
			if cookie, cookieErr := r.Cookie(auth.CentralSessionCookieName); cookieErr == nil {
				if central == nil {
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
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
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
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
func optionalAuthMiddleware(svc centralUserEnsurer, central *auth.CentralClient, gateway *auth.GatewayClient, logger admin.Logger) func(http.Handler) http.Handler {
	required := authMiddleware(svc, central, gateway, logger)
	return func(next http.Handler) http.Handler {
		protected := required(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bearerToken(r) != "" || len(r.Cookies()) > 0 {
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
	r.Header.Del("X-User-Subject")
	r.Header.Del("X-User-Issuer")
	r.Header.Del("X-User-Id")
	r.Header.Del("X-User-Email")
	r.Header.Del("X-User-Roles")
}
