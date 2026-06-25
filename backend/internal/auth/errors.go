package auth

import "errors"

var (
	ErrInvalidCredentials     = errors.New("auth: invalid credentials")
	ErrInvalidToken           = errors.New("auth: invalid or expired token")
	ErrEmailTaken             = errors.New("auth: email already registered")
	ErrWeakPassword           = errors.New("auth: password must be at least 8 characters")
	ErrEmailRequired          = errors.New("auth: email is required")
	ErrEmailNotVerified       = errors.New("auth: email not verified")
	ErrVerificationTokenInvalid = errors.New("auth: invalid or expired verification token")
	ErrInvalidTargetLang      = errors.New("auth: invalid target language")
	ErrInvalidDefinitionLang  = errors.New("auth: invalid definition language")
	ErrInvalidUILang          = errors.New("auth: invalid ui language")
	ErrLanguageNotFound       = errors.New("auth: user language not found")
)
