package auth

// Non-production development bypass constants.
// Dev bypass is strictly forbidden in production and only active when AUTH_DEV_BYPASS=true.
const (
	DevBypassToken = "mock-dev-token"
	DevUserID      = "00000000-0000-0000-0000-000000000001"
	DevEmail       = "dev@project-pn.local"
)

// IsDevBypassToken checks if the token matches the development bypass token.
func IsDevBypassToken(token string) bool {
	return token == DevBypassToken
}
