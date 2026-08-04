package httpapi

import (
	"context"
	"net/http"
	"strings"

	"project-pn/internal/auth"
)

type contextKey string

const (
	userContextKey        contextKey = "authUser"
	authSessionContextKey contextKey = "authSession"
)

type authSession struct {
	method     authMethod
	credential string
}

type authMethod string

const (
	authMethodBearer authMethod = "bearer"
	authMethodCookie authMethod = "cookie"
)

func withUser(ctx context.Context, user auth.User) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

func withAuthSession(ctx context.Context, session authSession) context.Context {
	return context.WithValue(ctx, authSessionContextKey, session)
}

func userFromContext(ctx context.Context) (auth.User, bool) {
	user, ok := ctx.Value(userContextKey).(auth.User)
	return user, ok
}

func authSessionFromContext(ctx context.Context) (authSession, bool) {
	session, ok := ctx.Value(authSessionContextKey).(authSession)
	return session, ok
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
