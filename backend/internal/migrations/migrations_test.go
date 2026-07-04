package migrations

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLatestMigrationFilesExistAndAreNonEmpty(t *testing.T) {
	migrationsDir := repoPath(t, "db", "migrations")
	files := []string{
		"000018_user_languages_perf_idx.up.sql",
		"000018_user_languages_perf_idx.down.sql",
	}

	for _, name := range files {
		path := filepath.Join(migrationsDir, name)
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("stat %s: %v", name, err)
		}
		if info.Size() == 0 {
			t.Fatalf("migration %s is empty", name)
		}
	}
}

func TestLatestMigrationAppliesCleanly(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for migration smoke tests")
	}

	migrationsPath := "file://" + repoPath(t, "db", "migrations")

	if err := Down(migrationsPath, databaseURL, 1); err != nil {
		t.Fatalf("down migration before test: %v", err)
	}
	if err := Up(migrationsPath, databaseURL); err != nil {
		t.Fatalf("up migration: %v", err)
	}

	version, dirty, err := Version(migrationsPath, databaseURL)
	if err != nil {
		t.Fatalf("get version: %v", err)
	}
	if dirty {
		t.Fatal("migration is dirty")
	}
	if version != 18 {
		t.Fatalf("expected migration version 18, got %d", version)
	}
}
