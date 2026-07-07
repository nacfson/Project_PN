package httpapi

import (
	"context"
	"net/http"
	"strings"

	"project-pn/internal/auth"
)

type contextKey string

const userContextKey contextKey = "authUser"

func withUser(ctx context.Context, user auth.User) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

func userFromContext(ctx context.Context) (auth.User, bool) {
	user, ok := ctx.Value(userContextKey).(auth.User)
	return user, ok
}

// userIdentifierFromRequest returns the user's email when available, falling
// back to the user ID so log lines still contain a useful identifier.
func userIdentifierFromRequest(r *http.Request) string {
	if user, ok := userFromContext(r.Context()); ok {
		if email := strings.TrimSpace(user.Email); email != "" {
			return email
		}
	}
	return userIDFromRequest(r)
}
