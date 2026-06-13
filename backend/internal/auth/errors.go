package auth

import "errors"

var (
	ErrInvalidCredentials = errors.New("auth: invalid credentials")
	ErrInvalidToken       = errors.New("auth: invalid or expired token")
	ErrEmailTaken         = errors.New("auth: email already registered")
	ErrWeakPassword       = errors.New("auth: password must be at least 8 characters")
	ErrEmailRequired      = errors.New("auth: email is required")
	ErrOAuthInvalid       = errors.New("auth: invalid oauth token")
	ErrOAuthCannotLink    = errors.New("auth: cannot link oauth identity")
)
