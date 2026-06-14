package auth

// LanguagePair represents a target/definition language combination.
type LanguagePair struct {
	TargetLanguage     string `json:"target_language"`
	DefinitionLanguage string `json:"definition_language"`
}

// AllowedLanguages lists the languages users may select when unrestricted mode
// is not enabled. Empty slices mean "no restriction".
type AllowedLanguages struct {
	TargetLanguages     []string `json:"target_languages"`
	DefinitionLanguages []string `json:"definition_languages"`
}

// LanguageOptions is the public contract for GET /api/auth/language-options.
type LanguageOptions struct {
	Defaults LanguagePair     `json:"defaults"`
	Allowed  AllowedLanguages `json:"allowed"`
	Forced   LanguagePair     `json:"forced"`
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}
