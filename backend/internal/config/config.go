package config

import (
	"os"
	"strings"
	"time"
)

const (
	defaultAppAddr        = ":8080"
	defaultDatabaseURL    = "postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable"
	defaultMigrationsPath = "file://db/migrations"

	defaultUserID         = "00000000-0000-0000-0000-000000000001"
	defaultTargetLang     = "en"
	defaultDefinitionLang = "ko"

	defaultAllowedTargetLangs     = ""
	defaultAllowedDefinitionLangs = ""
	defaultForceTargetLang        = ""
	defaultForceDefinitionLang    = ""
	defaultUILang                 = "en"
	defaultAllowedUILangs         = ""
	defaultForceUILang            = ""

	defaultSessionTTL           = 720 * time.Hour
	defaultEmailVerificationTTL = 24 * time.Hour
	defaultEmailProvider        = "log"
	defaultAppPublicURL         = "http://localhost:8080"
	defaultAuthMode             = "local"

	// Web (Expo dev) and Tauri desktop WebView origins that may call the API.
	// Tauri serves the bundle from tauri://localhost (macOS) and
	// http://tauri.localhost (Windows).
	defaultAllowedOrigins = "http://localhost:8081,http://localhost:19006,tauri://localhost,http://tauri.localhost"
)

type Config struct {
	AppAddr        string
	DatabaseURL    string
	MigrationsPath string

	EnrichBaseURL string
	EnrichAPIKey  string
	EnrichModel   string

	DefaultUserID         string
	DefaultTargetLang     string
	DefaultDefinitionLang string

	AllowedTargetLangs     []string
	AllowedDefinitionLangs []string
	ForceTargetLang        string
	ForceDefinitionLang    string

	UILang         string
	AllowedUILangs []string
	ForceUILang    string

	AllowedOrigins []string

	AuthMode       string
	CentralAuthURL string

	SessionTTL           time.Duration
	EmailVerificationTTL time.Duration
	EmailProvider        string
	ResendAPIKey         string
	EmailFrom            string
	AppPublicURL         string

	NotificationWorkerEnabled  bool
	NotificationWorkerInterval time.Duration
	ExpoAccessToken            string
}

func Load() Config {
	return Config{
		AppAddr:        envOrDefault("APP_ADDR", defaultAppAddr),
		DatabaseURL:    envOrDefault("DATABASE_URL", defaultDatabaseURL),
		MigrationsPath: envOrDefault("MIGRATIONS_PATH", defaultMigrationsPath),

		EnrichBaseURL: os.Getenv("ENRICH_BASE_URL"),
		EnrichAPIKey:  os.Getenv("ENRICH_API_KEY"),
		EnrichModel:   os.Getenv("ENRICH_MODEL"),

		DefaultUserID:          envOrDefault("DEFAULT_USER_ID", defaultUserID),
		DefaultTargetLang:      envOrDefault("DEFAULT_TARGET_LANG", defaultTargetLang),
		DefaultDefinitionLang:  envOrDefault("DEFAULT_DEFINITION_LANG", defaultDefinitionLang),
		AllowedTargetLangs:     splitAndTrim(envOrDefault("ALLOWED_TARGET_LANGS", defaultAllowedTargetLangs)),
		AllowedDefinitionLangs: splitAndTrim(envOrDefault("ALLOWED_DEFINITION_LANGS", defaultAllowedDefinitionLangs)),
		ForceTargetLang:        envOrDefault("FORCE_TARGET_LANG", defaultForceTargetLang),
		ForceDefinitionLang:    envOrDefault("FORCE_DEFINITION_LANG", defaultForceDefinitionLang),
		UILang:                 envOrDefault("DEFAULT_UI_LANGUAGE", defaultUILang),
		AllowedUILangs:         splitAndTrim(envOrDefault("ALLOWED_UI_LANGUAGES", defaultAllowedUILangs)),
		ForceUILang:            envOrDefault("FORCE_UI_LANGUAGE", defaultForceUILang),

		AllowedOrigins: splitAndTrim(envOrDefault("ALLOWED_ORIGINS", defaultAllowedOrigins)),

		AuthMode:       strings.ToLower(envOrDefault("AUTH_MODE", defaultAuthMode)),
		CentralAuthURL: strings.TrimRight(os.Getenv("CENTRAL_AUTH_URL"), "/"),

		SessionTTL:           durationOrDefault("SESSION_TTL", defaultSessionTTL),
		EmailVerificationTTL: durationOrDefault("EMAIL_VERIFICATION_TTL", defaultEmailVerificationTTL),
		EmailProvider:        envOrDefault("EMAIL_PROVIDER", defaultEmailProvider),
		ResendAPIKey:         os.Getenv("RESEND_API_KEY"),
		EmailFrom:            os.Getenv("EMAIL_FROM"),
		AppPublicURL:         envOrDefault("APP_PUBLIC_URL", defaultAppPublicURL),

		NotificationWorkerEnabled:  envBool("NOTIFICATION_WORKER_ENABLED", true),
		NotificationWorkerInterval: durationOrDefault("NOTIFICATION_WORKER_INTERVAL", 15*time.Minute),
		ExpoAccessToken:            os.Getenv("EXPO_ACCESS_TOKEN"),
	}
}

func splitAndTrim(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func envOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func durationOrDefault(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	switch value {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}
