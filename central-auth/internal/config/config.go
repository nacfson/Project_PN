package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr                 string
	DatabaseURL          string
	MigrationsPath       string
	SessionInternalToken string
	CookieDomain         string
	AccessTokenTTL       time.Duration
	RefreshTokenTTL      time.Duration
	SessionIdleTimeout   time.Duration
	SessionMaxAge        time.Duration
	PublicBaseURL        string
	GoogleClientID       string
	GoogleClientSecret   string
	GoogleRedirectURI    string
	AdminEmails          []string
}

func Load() Config {
	publicBase := strings.TrimRight(env("PUBLIC_BASE_URL", "http://localhost:8090"), "/")
	googleRedirect := strings.TrimSpace(os.Getenv("GOOGLE_REDIRECT_URI"))
	if googleRedirect == "" {
		googleRedirect = publicBase + "/auth/google/callback"
	}
	adminRaw := env("ADMIN_EMAILS", "nacfson@gmail.com")
	var adminEmails []string
	for _, part := range strings.Split(adminRaw, ",") {
		if email := strings.ToLower(strings.TrimSpace(part)); email != "" {
			adminEmails = append(adminEmails, email)
		}
	}
	return Config{
		Addr:                 env("APP_ADDR", ":8090"),
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		MigrationsPath:       env("MIGRATIONS_PATH", "file://db/migrations"),
		SessionInternalToken: strings.TrimSpace(os.Getenv("AUTH_SESSION_INTERNAL_TOKEN")),
		CookieDomain:         env("COOKIE_DOMAIN", "nacfson.cloud"),
		AccessTokenTTL:       durationEnv("ACCESS_TOKEN_TTL", time.Hour),
		RefreshTokenTTL:      durationEnv("REFRESH_TOKEN_TTL", 90*24*time.Hour),
		SessionIdleTimeout:   durationEnv("SESSION_IDLE_TIMEOUT", 7*24*time.Hour),
		SessionMaxAge:        durationEnv("SESSION_MAX_AGE", 30*24*time.Hour),
		PublicBaseURL:        publicBase,
		GoogleClientID:       strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")),
		GoogleClientSecret:   strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")),
		GoogleRedirectURI:    googleRedirect,
		AdminEmails:          adminEmails,
	}
}

func (c Config) GoogleConfigured() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != ""
}

func (c Config) IsAdminEmail(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	for _, admin := range c.AdminEmails {
		if admin == email {
			return true
		}
	}
	return false
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	if seconds, err := strconv.Atoi(raw); err == nil {
		return time.Duration(seconds) * time.Second
	}
	if parsed, err := time.ParseDuration(raw); err == nil {
		return parsed
	}
	return fallback
}
