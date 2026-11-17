package db

import (
	"testing"
	"time"
)

func TestParsePoolConfig_CapsLifetimeBelowProxyCutoff(t *testing.T) {
	cfg, err := ParsePoolConfig("postgres://user:pass@localhost:5432/proj_pn?sslmode=disable")
	if err != nil {
		t.Fatalf("ParsePoolConfig: %v", err)
	}

	if cfg.MaxConnLifetime <= 0 || cfg.MaxConnLifetime > 5*time.Minute {
		t.Fatalf("expected MaxConnLifetime in (0, 5m], got %v", cfg.MaxConnLifetime)
	}
	if cfg.MaxConnLifetime != 5*time.Minute {
		t.Fatalf("expected MaxConnLifetime 5m, got %v", cfg.MaxConnLifetime)
	}
	if cfg.MaxConnLifetimeJitter != 30*time.Second {
		t.Fatalf("expected MaxConnLifetimeJitter 30s, got %v", cfg.MaxConnLifetimeJitter)
	}
	if cfg.MaxConnIdleTime != 2*time.Minute {
		t.Fatalf("expected MaxConnIdleTime 2m, got %v", cfg.MaxConnIdleTime)
	}
	if cfg.HealthCheckPeriod != 30*time.Second {
		t.Fatalf("expected HealthCheckPeriod 30s, got %v", cfg.HealthCheckPeriod)
	}
}
