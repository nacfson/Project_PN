package config

import (
	"os"
	"strings"
)

const (
	defaultAppAddr        = ":8080"
	defaultDatabaseURL    = "postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable"
	defaultMigrationsPath = "file://db/migrations"

	defaultUserID         = "00000000-0000-0000-0000-000000000001"
	defaultTargetLang     = "en"
	defaultDefinitionLang = "ko"

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

	AllowedOrigins []string
}

func Load() Config {
	return Config{
		AppAddr:        envOrDefault("APP_ADDR", defaultAppAddr),
		DatabaseURL:    envOrDefault("DATABASE_URL", defaultDatabaseURL),
		MigrationsPath: envOrDefault("MIGRATIONS_PATH", defaultMigrationsPath),

		EnrichBaseURL: os.Getenv("ENRICH_BASE_URL"),
		EnrichAPIKey:  os.Getenv("ENRICH_API_KEY"),
		EnrichModel:   os.Getenv("ENRICH_MODEL"),

		DefaultUserID:         envOrDefault("DEFAULT_USER_ID", defaultUserID),
		DefaultTargetLang:     envOrDefault("DEFAULT_TARGET_LANG", defaultTargetLang),
		DefaultDefinitionLang: envOrDefault("DEFAULT_DEFINITION_LANG", defaultDefinitionLang),

		AllowedOrigins: splitAndTrim(envOrDefault("ALLOWED_ORIGINS", defaultAllowedOrigins)),
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
