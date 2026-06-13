package httpapi

import (
	"context"

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
