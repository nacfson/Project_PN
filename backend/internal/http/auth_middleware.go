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

func authMiddleware(verifier *auth.JWTVerifier, svc platformUserEnsurer, devBypass bool, logger admin.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			discardClientIdentityHeaders(r)

			token := bearerToken(r)
			if token == "" {
				writeCodedError(w, http.StatusUnauthorized, "AUTH-101", "unauthorized", false)
				return
			}

			var (
				authResult auth.AuthResult
				err        error
			)

			// Non-production dev bypass: strictly gated by devBypass flag
			if devBypass && auth.IsDevBypassToken(token) {
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
				method:     authMethodBearer,
				credential: token,
			}
			ctx := withAuthSession(r.Context(), credentials)
			ctx = withAuthResult(ctx, authResult)
			next.ServeHTTP(w, r.WithContext(withUser(ctx, authResult.User)))
		})
	}
}

// optionalAuthMiddleware attaches an API-verified actor if a Bearer credential exists.
func optionalAuthMiddleware(verifier *auth.JWTVerifier, svc platformUserEnsurer, devBypass bool, logger admin.Logger) func(http.Handler) http.Handler {
	required := authMiddleware(verifier, svc, devBypass, logger)
	return func(next http.Handler) http.Handler {
		protected := required(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bearerToken(r) != "" {
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
