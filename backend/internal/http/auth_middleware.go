package httpapi

import (
	"context"
	"net/http"
	"strings"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

type platformUserEnsurer interface {
	EnsurePlatformUser(ctx context.Context, issuer, subject, email, signInMethod string) (auth.AuthResult, error)
}

func authMiddleware(verifier *auth.JWTVerifier, svc platformUserEnsurer, devBypass bool, gateway *auth.GatewayClient, logger admin.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			discardClientIdentityHeaders(r)

			sessionMethod := authMethodBearer
			rawBearer := bearerToken(r)
			token := rawBearer
			sessionCredential := rawBearer

			var confirmedIdent *auth.ConfirmedIdentity
			if strings.HasPrefix(rawBearer, "v1.") {
				if gateway == nil {
					if logger != nil {
						logger.Logf("AUTH_FAILURE", "gateway unconfigured for v1 session handle from %s", r.RemoteAddr)
					}
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
					return
				}
				ident, refreshedHandle, err := gateway.ConfirmSessionHandle(r.Context(), r.Host, rawBearer)
				if err != nil || ident == nil || ident.Token == "" {
					if logger != nil && err != nil {
						logger.Logf("AUTH_FAILURE", "gateway session handle confirmation failed from %s: %v", r.RemoteAddr, err)
					}
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
					return
				}
				if refreshedHandle != "" {
					w.Header().Set("X-Refreshed-Session-Handle", refreshedHandle)
				}
				confirmedIdent = ident
				token = ident.Token
				sessionCredential = rawBearer
			} else if token == "" {
				if gateway != nil && gateway.SignInMode() == auth.SignInShared && len(r.Cookies()) > 0 {
					if c, cookieErr := r.Cookie(auth.CentralSessionCookieName); cookieErr == nil && strings.HasPrefix(strings.TrimSpace(c.Value), "v1.") {
						rawHandle := strings.TrimSpace(c.Value)
						ident, refreshedHandle, err := gateway.ConfirmSessionHandle(r.Context(), r.Host, rawHandle)
						if err != nil || ident == nil || ident.Token == "" {
							if logger != nil && err != nil {
								logger.Logf("AUTH_FAILURE", "gateway cookie session handle confirmation failed from %s: %v", r.RemoteAddr, err)
							}
							writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
							return
						}
						if refreshedHandle != "" {
							http.SetCookie(w, &http.Cookie{
								Name:     auth.CentralSessionCookieName,
								Value:    refreshedHandle,
								Path:     "/",
								MaxAge:   8 * 3600,
								HttpOnly: true,
								Secure:   true,
								SameSite: http.SameSiteLaxMode,
							})
						}
						confirmedIdent = ident
						token = ident.Token
						sessionCredential = rawHandle
						sessionMethod = authMethodCookie
					} else {
						ident, err := gateway.ConfirmIdentity(r.Context(), r.Host, r.Cookies())
						if err != nil {
							if logger != nil {
								logger.Logf("AUTH_FAILURE", "gateway confirmation error from %s: %v", r.RemoteAddr, err)
							}
							writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
							return
						}
						if ident != nil && ident.Token != "" {
							confirmedIdent = ident
							token = ident.Token
							sessionCredential = ident.Token
							sessionMethod = authMethodCookie
						}
					}
				}
			}

			if token == "" {
				writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
				return
			}

			var (
				authResult auth.AuthResult
				err        error
			)

			// 1. Gateway-confirmed session handle or cookie: trust the internal gateway verification directly (no Keycloak JWKS dependency).
			if confirmedIdent != nil {
				authResult, err = svc.EnsurePlatformUser(
					r.Context(),
					confirmedIdent.Issuer,
					confirmedIdent.Subject,
					confirmedIdent.Email,
					"google",
				)
				if err != nil {
					if logger != nil {
						logger.Logf("AUTH_FAILURE", "ensure platform user failed: %v", err)
					}
					writeCodedError(w, http.StatusInternalServerError, "AUTH-599", "internal error", true)
					return
				}
			} else if devBypass && auth.IsDevBypassToken(token) {
				// 2. Non-production dev bypass: strictly gated by devBypass flag
				authResult, err = svc.EnsurePlatformUser(
					r.Context(),
					"https://auth.nacfson.cloud/realms/platform",
					auth.DevUserID,
					auth.DevEmail,
					"google",
				)
				if err != nil {
					writeCodedError(w, http.StatusInternalServerError, "AUTH-599", "internal error", true)
					return
				}
			} else {
				if verifier == nil {
					if logger != nil {
						logger.Logf("AUTH_FAILURE", "jwt verifier unconfigured from %s", r.RemoteAddr)
					}
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
					return
				}

				claims, verifyErr := verifier.Verify(r.Context(), token)
				if verifyErr != nil {
					if logger != nil {
						logger.Logf("AUTH_FAILURE", "jwt verification failed from %s: %v", r.RemoteAddr, verifyErr)
					}
					writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
					return
				}

				authResult, err = svc.EnsurePlatformUser(
					r.Context(),
					claims.Issuer,
					claims.Subject,
					claims.Email,
					claims.SignInMethod,
				)
				if err != nil {
					if logger != nil {
						logger.Logf("AUTH_FAILURE", "ensure platform user failed: %v", err)
					}
					writeCodedError(w, http.StatusInternalServerError, "AUTH-599", "internal error", true)
					return
				}
			}

			credentials := authSession{
				method:     sessionMethod,
				credential: sessionCredential,
			}
			ctx := withAuthSession(r.Context(), credentials)
			ctx = withAuthResult(ctx, authResult)
			next.ServeHTTP(w, r.WithContext(withUser(ctx, authResult.User)))
		})
	}
}

// optionalAuthMiddleware attaches an API-verified actor if a Bearer credential or session cookie exists.
func optionalAuthMiddleware(verifier *auth.JWTVerifier, svc platformUserEnsurer, devBypass bool, gateway *auth.GatewayClient, logger admin.Logger) func(http.Handler) http.Handler {
	required := authMiddleware(verifier, svc, devBypass, gateway, logger)
	return func(next http.Handler) http.Handler {
		protected := required(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bearerToken(r) != "" || (gateway != nil && len(r.Cookies()) > 0) {
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
				if ok && logger != nil {
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
