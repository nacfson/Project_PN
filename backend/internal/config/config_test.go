package config

import (
	"os"
	"testing"
)

func TestLoad_DatabaseURLNoDefault(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	cfg := Load()
	if cfg.DatabaseURL != "" {
		t.Fatalf("expected empty DatabaseURL when env unset, got %q", cfg.DatabaseURL)
	}
}

func TestLoad_AdminLogPathDefault(t *testing.T) {
	os.Unsetenv("ADMIN_LOG_PATH")
	cfg := Load()
	if cfg.AdminLogPath != "/var/log/project-pn/admin.log" {
		t.Fatalf("expected default admin log path, got %q", cfg.AdminLogPath)
	}
}

func TestLoad_AdminLogPathFromEnv(t *testing.T) {
	t.Setenv("ADMIN_LOG_PATH", "/tmp/test-admin.log")
	cfg := Load()
	if cfg.AdminLogPath != "/tmp/test-admin.log" {
		t.Fatalf("expected env admin log path, got %q", cfg.AdminLogPath)
	}
}

func unsetEnrichEnv() {
	os.Unsetenv("ENRICH_PRIMARY_BASE_URL")
	os.Unsetenv("ENRICH_BASE_URL")
	os.Unsetenv("ENRICH_PRIMARY_MODEL")
	os.Unsetenv("ENRICH_MODEL")
}

func TestLoad_EnrichDefaultsToGeminiWhenUnset(t *testing.T) {
	unsetEnrichEnv()
	cfg := Load()
	if cfg.EnrichPrimaryBaseURL != defaultEnrichPrimaryBaseURL {
		t.Fatalf("expected built-in Gemini base URL, got %q", cfg.EnrichPrimaryBaseURL)
	}
	if cfg.EnrichPrimaryModel != defaultEnrichPrimaryModel {
		t.Fatalf("expected built-in Gemini model, got %q", cfg.EnrichPrimaryModel)
	}
}

func TestLoad_EnrichExplicitEnvOverridesDefaults(t *testing.T) {
	unsetEnrichEnv()
	t.Setenv("ENRICH_PRIMARY_BASE_URL", "https://api.groq.com/openai/v1")
	t.Setenv("ENRICH_PRIMARY_MODEL", "llama-3.1-8b-instant")
	cfg := Load()
	if cfg.EnrichPrimaryBaseURL != "https://api.groq.com/openai/v1" {
		t.Fatalf("expected env base URL, got %q", cfg.EnrichPrimaryBaseURL)
	}
	if cfg.EnrichPrimaryModel != "llama-3.1-8b-instant" {
		t.Fatalf("expected env model, got %q", cfg.EnrichPrimaryModel)
	}
}

func TestLoad_EnrichLegacyAliasWinsWithoutModelDefault(t *testing.T) {
	unsetEnrichEnv()
	t.Setenv("ENRICH_BASE_URL", "http://localhost:1234")
	cfg := Load()
	if cfg.EnrichPrimaryBaseURL != "http://localhost:1234" {
		t.Fatalf("expected legacy alias base URL, got %q", cfg.EnrichPrimaryBaseURL)
	}
	if cfg.EnrichPrimaryModel != "" {
		t.Fatalf("expected empty model for custom provider without explicit model, got %q", cfg.EnrichPrimaryModel)
	}
}
