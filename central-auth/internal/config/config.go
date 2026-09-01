package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr                    string
	DatabaseURL             string
	MigrationsPath          string
	SessionInternalToken    string
	CookieDomain            string
	AccessTokenTTL          time.Duration
	RefreshTokenTTL         time.Duration
	SessionIdleTimeout      time.Duration
	SessionMaxAge           time.Duration
	MagicLinkTTL            time.Duration
	DevLogMagicLinks        bool
}

func Load() Config {
	return Config{
		Addr:                 env("APP_ADDR", ":8090"),
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		MigrationsPath:         env("MIGRATIONS_PATH", "file://db/migrations"),
		SessionInternalToken: strings.TrimSpace(os.Getenv("AUTH_SESSION_INTERNAL_TOKEN")),
		CookieDomain:         env("COOKIE_DOMAIN", "nacfson.cloud"),
		AccessTokenTTL:       durationEnv("ACCESS_TOKEN_TTL", time.Hour),
		RefreshTokenTTL:      durationEnv("REFRESH_TOKEN_TTL", 90*24*time.Hour),
		SessionIdleTimeout:   durationEnv("SESSION_IDLE_TIMEOUT", 7*24*time.Hour),
		SessionMaxAge:        durationEnv("SESSION_MAX_AGE", 30*24*time.Hour),
		MagicLinkTTL:         durationEnv("MAGIC_LINK_TTL", 15*time.Minute),
		DevLogMagicLinks:     env("DEV_LOG_MAGIC_LINKS", "true") == "true",
	}
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
