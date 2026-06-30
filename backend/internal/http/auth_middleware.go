package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/httprate"

	"project-pn/internal/auth"
)

const authRateLimit = 10

func authIPRateLimit() func(http.Handler) http.Handler {
	return httprate.Limit(
		authRateLimit,
		time.Minute,
		httprate.WithKeyFuncs(keyByRealIP),
		httprate.WithLimitHandler(rateLimitResponse),
	)
}

func authEmailRateLimit() func(http.Handler) http.Handler {
	return httprate.Limit(
		authRateLimit,
		time.Minute,
		httprate.WithKeyFuncs(emailKeyFromBody),
		httprate.WithLimitHandler(rateLimitResponse),
	)
}

func consumeIPRateLimit() func(http.Handler) http.Handler {
	return httprate.Limit(
		20,
		time.Minute,
		httprate.WithKeyFuncs(keyByRealIP),
		httprate.WithLimitHandler(rateLimitResponse),
	)
}

func emailKeyFromBody(r *http.Request) (string, error) {
	email, err := peekRequestEmail(r)
	if err != nil || email == "" {
		return keyByRealIP(r)
	}
	return "email:" + auth.NormalizeEmail(email), nil
}

func peekRequestEmail(r *http.Request) (string, error) {
	if r.Body == nil {
		return "", nil
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return "", err
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	var payload struct {
		Email string `json:"email"`
	}
	if len(body) == 0 {
		return "", nil
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", nil
	}
	return payload.Email, nil
}

func authMiddleware(svc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r)
			user, err := svc.Authenticate(r.Context(), token)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			next.ServeHTTP(w, r.WithContext(withUser(r.Context(), user)))
		})
	}
}

func centralAuthMiddleware(svc *auth.Service, central *auth.CentralClient) func(http.Handler) http.Handler {
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
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			user, err := svc.EnsureCentralUser(r.Context(), session.User)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			next.ServeHTTP(w, r.WithContext(withUser(r.Context(), user)))
		})
	}
}

func authMiddlewareForMode(local *auth.Service, central *auth.CentralClient, mode string) func(http.Handler) http.Handler {
	if mode == "central" {
		return centralAuthMiddleware(local, central)
	}
	return authMiddleware(local)
}

func requireVerified() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := userFromContext(r.Context())
			if !ok || !user.IsEmailVerified() {
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

func writeRateLimited(w http.ResponseWriter) {
	writeError(w, http.StatusTooManyRequests, "too many requests")
}

func rateLimitResponse(w http.ResponseWriter, _ *http.Request) {
	writeRateLimited(w)
}
