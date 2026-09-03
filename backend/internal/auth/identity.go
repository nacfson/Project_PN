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

type LinkRecommendation struct {
	Provider string `json:"provider"`
	Email    string `json:"email"`
}

type MergeSuggestion struct {
	SourceUserID string `json:"source_user_id"`
	SourceEmail  string `json:"source_email"`
	Domain       string `json:"domain"`
}

type PendingIdentity struct {
	Provider        string
	ProviderSubject string
	Email           string
}

type AuthResult struct {
	User               User
	LinkRecommendation *LinkRecommendation
	PendingIdentity    *PendingIdentity
}

func MapCentralProvider(authProvider, providerSubject, centralUserID string) (pnProvider, pnSubject string) {
	switch authProvider {
	case "google":
		return ProviderGoogle, providerSubject
	default:
		return ProviderNacfson, centralUserID
	}
}

func PNProviderLabel(provider string) string {
	switch provider {
	case ProviderGoogle:
		return "google"
	case ProviderNacfson:
		return "nacfson"
	default:
		return provider
	}
}

// SessionFromCentralUser builds a CentralSession for tests and legacy callers.
func SessionFromCentralUser(user CentralUser, authProvider string) CentralSession {
	if authProvider == "" {
		authProvider = "magic_link"
	}
	subject := user.ID
	if authProvider == "google" {
		subject = "google-sub-" + user.ID
	}
	return CentralSession{
		AuthProvider: authProvider,
		Identity: CentralIdentity{
			Provider:        authProvider,
			ProviderSubject: subject,
		},
		User: user,
	}
}
