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

func TestLoad_LearningLogDirDefaultEmpty(t *testing.T) {
	t.Setenv("LEARNING_LOG_DIR", "")
	cfg := Load()
	if cfg.LearningLogDir != "" {
		t.Fatalf("expected empty learning log dir by default, got %q", cfg.LearningLogDir)
	}
}

func TestLoad_LearningLogDirFromEnv(t *testing.T) {
	t.Setenv("LEARNING_LOG_DIR", "/tmp/pn-learning")
	cfg := Load()
	if cfg.LearningLogDir != "/tmp/pn-learning" {
		t.Fatalf("expected env learning log dir, got %q", cfg.LearningLogDir)
	}
}

func TestLoad_CentralCookieAuthConfiguration(t *testing.T) {
	t.Setenv("CENTRAL_AUTH_INTERNAL_URL", "http://auth.internal")
	t.Setenv("AUTH_SESSION_INTERNAL_TOKEN", "internal-secret")

	cfg := Load()

	if cfg.CentralAuthInternalURL != "http://auth.internal" {
		t.Fatalf("expected internal auth URL, got %q", cfg.CentralAuthInternalURL)
	}
	if cfg.AuthSessionInternalToken != "internal-secret" {
		t.Fatalf("expected internal auth token, got %q", cfg.AuthSessionInternalToken)
	}
}
