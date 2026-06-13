package oauth

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/api/idtoken"

	"project-pn/internal/auth"
)

// GoogleVerifier validates Google ID tokens against configured client IDs.
type GoogleVerifier struct {
	clientIDs []string
}

func NewGoogleVerifier(clientIDs []string) *GoogleVerifier {
	return &GoogleVerifier{clientIDs: clientIDs}
}

func (v *GoogleVerifier) Verify(ctx context.Context, idToken string) (auth.OAuthClaims, error) {
	if idToken == "" {
		return auth.OAuthClaims{}, errors.New("oauth: empty id token")
	}
	if len(v.clientIDs) == 0 {
		return auth.OAuthClaims{}, errors.New("oauth: no google client ids configured")
	}

	var lastErr error
	for _, audience := range v.clientIDs {
		payload, err := idtoken.Validate(ctx, idToken, audience)
		if err != nil {
			lastErr = err
			continue
		}

		email, _ := payload.Claims["email"].(string)
		emailVerified, _ := payload.Claims["email_verified"].(bool)

		return auth.OAuthClaims{
			Subject:       payload.Subject,
			Email:         email,
			EmailVerified: emailVerified,
		}, nil
	}

	if lastErr != nil {
		return auth.OAuthClaims{}, fmt.Errorf("oauth: validate google id token: %w", lastErr)
	}
	return auth.OAuthClaims{}, errors.New("oauth: validate google id token")
}
