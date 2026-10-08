package auth

import "time"

const (
	ProviderNacfson = "nacfson"
	ProviderGoogle  = "google"
)

type CentralIdentity struct {
	Provider        string `json:"provider"`
	ProviderSubject string `json:"provider_subject"`
}

type LinkedProvider struct {
	Provider string
	Email    string
	LinkedAt time.Time
}

type MergeSuggestion struct {
	SourceUserID string `json:"source_user_id"`
	SourceEmail  string `json:"source_email"`
	Domain       string `json:"domain"`
}

type AuthResult struct {
	User            User
	SessionProvider string // mapped PN provider for this session ('google')
}

func MapCentralProvider(authProvider, providerSubject, centralUserID string) (pnProvider, pnSubject string) {
	if providerSubject != "" {
		return ProviderGoogle, providerSubject
	}
	return ProviderGoogle, centralUserID
}

func PNProviderLabel(provider string) string {
	switch provider {
	case ProviderGoogle:
		return "google"
	default:
		return provider
	}
}

// SessionFromCentralUser builds a CentralSession for tests and legacy callers.
func SessionFromCentralUser(user CentralUser, authProvider string) CentralSession {
	if authProvider == "" {
		authProvider = "google"
	}
	subject := "google-sub-" + user.ID
	return CentralSession{
		AuthProvider: authProvider,
		Identity: CentralIdentity{
			Provider:        authProvider,
			ProviderSubject: subject,
		},
		User: user,
	}
}
