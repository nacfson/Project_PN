package config

import (
	"os"
	"strings"
	"time"
)

const (
	defaultAppAddr        = ":8080"
	defaultMigrationsPath = "file://db/migrations"
	// No defaultDatabaseURL — DATABASE_URL must be provided by the environment.

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

	// Web (Expo dev) and Tauri desktop WebView origins that may call the API.
	// Tauri serves the bundle from tauri://localhost (macOS) and
	// http://tauri.localhost (Windows).
	defaultAllowedOrigins = "http://localhost:8081,http://localhost:19006,tauri://localhost,http://tauri.localhost"

	defaultDevExtensionID  = ""
	defaultProdExtensionID = ""
)

type Config struct {
	AppAddr        string
	DatabaseURL    string
	MigrationsPath string

	EnrichPrimaryBaseURL string
	EnrichPrimaryAPIKey  string
	EnrichPrimaryModel   string

	EnrichFallbackBaseURL string
	EnrichFallbackAPIKey  string
	EnrichFallbackModel   string

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

	CentralAuthURL        string
	CentralAuthInternalURL string

	NotificationWorkerEnabled  bool
	NotificationWorkerInterval time.Duration
	ExpoAccessToken            string
}

func Load() Config {
	return Config{
		AppAddr:        envOrDefault("APP_ADDR", defaultAppAddr),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		MigrationsPath: envOrDefault("MIGRATIONS_PATH", defaultMigrationsPath),

		EnrichPrimaryBaseURL: envOrDefault("ENRICH_PRIMARY_BASE_URL", os.Getenv("ENRICH_BASE_URL")),
		EnrichPrimaryAPIKey:  envOrDefault("ENRICH_PRIMARY_API_KEY", os.Getenv("ENRICH_API_KEY")),
		EnrichPrimaryModel:   envOrDefault("ENRICH_PRIMARY_MODEL", os.Getenv("ENRICH_MODEL")),

		EnrichFallbackBaseURL: os.Getenv("ENRICH_FALLBACK_BASE_URL"),
		EnrichFallbackAPIKey:  os.Getenv("ENRICH_FALLBACK_API_KEY"),
		EnrichFallbackModel:   os.Getenv("ENRICH_FALLBACK_MODEL"),

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

		AllowedOrigins: buildAllowedOrigins(
			splitAndTrim(envOrDefault("ALLOWED_ORIGINS", defaultAllowedOrigins)),
			envOrDefault("PN_DEV_EXTENSION_ID", defaultDevExtensionID),
			envOrDefault("PN_PROD_EXTENSION_ID", defaultProdExtensionID),
		),

		CentralAuthURL:         strings.TrimRight(os.Getenv("CENTRAL_AUTH_URL"), "/"),
		CentralAuthInternalURL: strings.TrimRight(os.Getenv("CENTRAL_AUTH_INTERNAL_URL"), "/"),

		NotificationWorkerEnabled:  envBool("NOTIFICATION_WORKER_ENABLED", true),
		NotificationWorkerInterval: durationOrDefault("NOTIFICATION_WORKER_INTERVAL", 15*time.Minute),
		ExpoAccessToken:            os.Getenv("EXPO_ACCESS_TOKEN"),
	}
}

func buildAllowedOrigins(base []string, devExtensionID, prodExtensionID string) []string {
	origins := make([]string, len(base))
	copy(origins, base)
	if devExtensionID != "" {
		origins = append(origins, "chrome-extension://"+devExtensionID)
	}
	if prodExtensionID != "" {
		origins = append(origins, "chrome-extension://"+prodExtensionID)
	}
	return origins
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
