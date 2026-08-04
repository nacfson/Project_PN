package auth

import "errors"

var (
	ErrInvalidToken              = errors.New("auth: invalid or expired token")
	ErrInternalAuthNotConfigured = errors.New("auth: internal central auth is not configured")
	ErrInvalidTargetLang         = errors.New("auth: invalid target language")
	ErrInvalidDefinitionLang     = errors.New("auth: invalid definition language")
	ErrInvalidUILang             = errors.New("auth: invalid ui language")
	ErrLanguageNotFound          = errors.New("auth: user language not found")
	ErrTargetLanguageExists      = errors.New("auth: target language already exists")
)
