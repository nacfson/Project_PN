package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultAppAddr        = ":8080"
	defaultMigrationsPath = "file://db/migrations"
	// No defaultDatabaseURL — set DATABASE_URL explicitly (local Compose) or
	// assemble from DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_TOKEN (vault-db-proxy).

	defaultDBHost = "vault-db-proxy.vault.svc"
	defaultDBPort = "5432"
	defaultDBName = "proj_pn"
	defaultDBUser = "project:pn:workload:backend"

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

	// Default free gloss origin (WiktApi / Wiktionary). No API key required.
	defaultOriginWiktAPIBaseURL = "https://api.wiktapi.dev"

	// Optional legacy Gemini OpenAI-compatible shim (not the default path).
	defaultEnrichPrimaryBaseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
	defaultEnrichPrimaryModel   = "gemini-3.1-flash-lite"

	defaultAdminLogPath = "/var/log/project-pn/admin.log"
)

type Config struct {
	AppAddr        string
	DatabaseURL    string
	MigrationsPath string

	// OriginWiktAPIBaseURL is the free gloss dictionary origin (no API key).
	OriginWiktAPIBaseURL string

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

	SignIn         string
	GatewayAuthURL string

	CentralAuthURL           string
	CentralAuthInternalURL   string
	AuthSessionInternalToken string
	PublicAppURL             string

	// Gateway JWT configuration
	AuthJWTIssuer      string
	AuthJWTAudience    string
	AuthJWTJWKSURL     string
	AuthJWTAllowedAlgs []string
	AuthJWTClockSkew   time.Duration
	AuthDevBypass      bool

	NotificationWorkerEnabled  bool
	NotificationWorkerInterval time.Duration
	ExpoAccessToken            string

	AdminLogPath string

	LearningLogDir   string
	AnalyticsEnabled bool
}

func Load() Config {
	enrichPrimaryBaseURL := envOrDefault("ENRICH_PRIMARY_BASE_URL", os.Getenv("ENRICH_BASE_URL"))
	enrichPrimaryModel := envOrDefault("ENRICH_PRIMARY_MODEL", os.Getenv("ENRICH_MODEL"))
	// Only apply Gemini defaults when an API key is present (legacy optional path).
	enrichPrimaryKey := envOrDefault("ENRICH_PRIMARY_API_KEY", os.Getenv("ENRICH_API_KEY"))
	if enrichPrimaryKey != "" && enrichPrimaryBaseURL == "" {
		enrichPrimaryBaseURL = defaultEnrichPrimaryBaseURL
		if enrichPrimaryModel == "" {
			enrichPrimaryModel = defaultEnrichPrimaryModel
		}
	}

	jwtIssuer := strings.TrimRight(strings.TrimSpace(envOrDefault("AUTH_JWT_ISSUER", "https://auth.nacfson.cloud/realms/platform")), "/")
	jwtAudience := strings.TrimSpace(envOrDefault("AUTH_JWT_AUDIENCE", "project-pn"))
	jwtJWKSURL := strings.TrimSpace(envOrDefault("AUTH_JWT_JWKS_URL", "http://keycloak-service.identity.svc:8080/realms/platform/protocol/openid-connect/certs"))
	allowedAlgs := splitAndTrim(envOrDefault("AUTH_JWT_ALLOWED_ALGS", "RS256"))
	if len(allowedAlgs) == 0 {
		allowedAlgs = []string{"RS256"}
	}

	return Config{
		AppAddr:        envOrDefault("APP_ADDR", defaultAppAddr),
		DatabaseURL:    resolveDatabaseURL(),
		MigrationsPath: envOrDefault("MIGRATIONS_PATH", defaultMigrationsPath),

		OriginWiktAPIBaseURL: envOrDefault("ORIGIN_WIKTAPI_BASE_URL", defaultOriginWiktAPIBaseURL),

		EnrichPrimaryBaseURL: enrichPrimaryBaseURL,
		EnrichPrimaryAPIKey:  enrichPrimaryKey,
		EnrichPrimaryModel:   enrichPrimaryModel,

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

		SignIn:         envOrDefault("SIGN_IN", "shared"),
		GatewayAuthURL: envOrDefault("GATEWAY_AUTH_URL", "http://gateway.identity.svc:8080/auth"),

		CentralAuthURL:           strings.TrimRight(os.Getenv("CENTRAL_AUTH_URL"), "/"),
		CentralAuthInternalURL:   strings.TrimRight(os.Getenv("CENTRAL_AUTH_INTERNAL_URL"), "/"),
		AuthSessionInternalToken: strings.TrimSpace(os.Getenv("AUTH_SESSION_INTERNAL_TOKEN")),
		PublicAppURL:             strings.TrimRight(strings.TrimSpace(envOrDefault("PUBLIC_APP_URL", "http://localhost:8081")), "/"),

		AuthJWTIssuer:      jwtIssuer,
		AuthJWTAudience:    jwtAudience,
		AuthJWTJWKSURL:     jwtJWKSURL,
		AuthJWTAllowedAlgs: allowedAlgs,
		AuthJWTClockSkew:   durationOrDefault("AUTH_JWT_CLOCK_SKEW", 1*time.Minute),
		AuthDevBypass:      envBool("AUTH_DEV_BYPASS", false),

		NotificationWorkerEnabled:  envBool("NOTIFICATION_WORKER_ENABLED", true),
		NotificationWorkerInterval: durationOrDefault("NOTIFICATION_WORKER_INTERVAL", 15*time.Minute),
		ExpoAccessToken:            os.Getenv("EXPO_ACCESS_TOKEN"),

		AdminLogPath: envOrDefault("ADMIN_LOG_PATH", defaultAdminLogPath),

		LearningLogDir:   os.Getenv("LEARNING_LOG_DIR"),
		AnalyticsEnabled: envBool("ANALYTICS_ENABLED", false),
	}
}

// resolveDatabaseURL prefers an explicit DATABASE_URL (local Compose / Oracle).
// When omitted, assembles a connection string from DB_* parts for the
// nacfson_pipeline vault-db-proxy (caller identity token as password).
func resolveDatabaseURL() string {
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		return databaseURL
	}
	if os.Getenv("DB_HOST") == "" {
		return ""
	}
	dbHost := envOrDefault("DB_HOST", defaultDBHost)
	dbPort := envOrDefault("DB_PORT", defaultDBPort)
	dbName := envOrDefault("DB_NAME", defaultDBName)
	dbUser := envOrDefault("DB_USER", defaultDBUser)
	// Under Zero-Plaintext Proxy, the workload caller token is the password field.
	dbPass := envOrDefault("DB_TOKEN", dbUser)
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		url.QueryEscape(dbUser), url.QueryEscape(dbPass), dbHost, dbPort, dbName)
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
