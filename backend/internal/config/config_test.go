package config

import (
	"testing"
)

func TestLoad_DatabaseURLNoDefault(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DB_HOST", "")
	cfg := Load()
	if cfg.DatabaseURL != "" {
		t.Fatalf("expected empty DatabaseURL when env unset, got %q", cfg.DatabaseURL)
	}
}

func TestLoad_DatabaseURLFromEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://local:pass@localhost:5433/project_pn_dev?sslmode=disable")
	t.Setenv("DB_HOST", "vault-db-proxy.vault.svc")
	cfg := Load()
	if cfg.DatabaseURL != "postgres://local:pass@localhost:5433/project_pn_dev?sslmode=disable" {
		t.Fatalf("expected explicit DATABASE_URL to win, got %q", cfg.DatabaseURL)
	}
}

func TestLoad_DatabaseURLAssembledFromDBParts(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DB_HOST", "vault-db-proxy.vault.svc")
	t.Setenv("DB_PORT", "5432")
	t.Setenv("DB_NAME", "proj_pn")
	t.Setenv("DB_USER", "project:pn:workload:backend")
	t.Setenv("DB_TOKEN", "project:pn:workload:backend")
	cfg := Load()
	want := "postgres://project%3Apn%3Aworkload%3Abackend:project%3Apn%3Aworkload%3Abackend@vault-db-proxy.vault.svc:5432/proj_pn?sslmode=disable"
	if cfg.DatabaseURL != want {
		t.Fatalf("expected assembled DatabaseURL\n  got:  %q\n  want: %q", cfg.DatabaseURL, want)
	}
}

func TestLoad_DatabaseURLAssembledDefaultsTokenToUser(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DB_HOST", "db.proxy")
	t.Setenv("DB_PORT", "")
	t.Setenv("DB_NAME", "")
	t.Setenv("DB_USER", "")
	t.Setenv("DB_TOKEN", "")
	cfg := Load()
	want := "postgres://project%3Apn%3Aworkload%3Abackend:project%3Apn%3Aworkload%3Abackend@db.proxy:5432/proj_pn?sslmode=disable"
	if cfg.DatabaseURL != want {
		t.Fatalf("expected defaults in assembled URL\n  got:  %q\n  want: %q", cfg.DatabaseURL, want)
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
