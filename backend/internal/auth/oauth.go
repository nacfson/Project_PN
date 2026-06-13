package auth

import "context"

// OAuthClaims holds verified identity data from an OAuth ID token.
type OAuthClaims struct {
	Subject       string
	Email         string
	EmailVerified bool
}

// OAuthVerifier validates an OAuth provider ID token.
type OAuthVerifier interface {
	Verify(ctx context.Context, idToken string) (OAuthClaims, error)
}
