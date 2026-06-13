package config

import "os"

const (
	defaultAppAddr        = ":8080"
	defaultDatabaseURL    = "postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable"
	defaultMigrationsPath = "file://db/migrations"
)

type Config struct {
	AppAddr        string
	DatabaseURL    string
	MigrationsPath string
}

func Load() Config {
	return Config{
		AppAddr:        envOrDefault("APP_ADDR", defaultAppAddr),
		DatabaseURL:    envOrDefault("DATABASE_URL", defaultDatabaseURL),
		MigrationsPath: envOrDefault("MIGRATIONS_PATH", defaultMigrationsPath),
	}
}

func envOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
