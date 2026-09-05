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
	ErrNoPendingIdentity         = errors.New("auth: no pending identity to link")
	ErrLinkRequestNotFound       = errors.New("auth: link request not found")
	ErrLinkRequestExpired        = errors.New("auth: link request expired")
	ErrLinkConfirmForbidden      = errors.New("auth: link confirm requires email session")
	ErrLinkResendCooldown         = errors.New("auth: link resend cooldown")
	ErrLinkIdentityConflict      = errors.New("auth: pending identity already linked to another user")
)
