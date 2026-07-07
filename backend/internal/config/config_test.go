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
