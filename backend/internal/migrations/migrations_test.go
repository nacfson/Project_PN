package migrations

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func latestMigrationVersion(t *testing.T) (uint, string) {
	t.Helper()
	migrationsDir := repoPath(t, "db", "migrations")
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}

	var (
		maxVersion uint
		latestName string
	)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		versionStr := strings.SplitN(name, "_", 2)[0]
		version, err := strconv.ParseUint(versionStr, 10, 32)
		if err != nil {
			t.Fatalf("invalid migration filename %q: %v", name, err)
		}
		if v := uint(version); v > maxVersion {
			maxVersion = v
			latestName = name
		}
	}
	if maxVersion == 0 {
		t.Fatal("no migration files found")
	}
	return maxVersion, latestName
}

func TestLatestMigrationFilesExistAndAreNonEmpty(t *testing.T) {
	_, latestName := latestMigrationVersion(t)
	migrationsDir := repoPath(t, "db", "migrations")
	latestBase := strings.TrimSuffix(latestName, ".up.sql")
	files := []string{
		filepath.Join(migrationsDir, latestName),
		filepath.Join(migrationsDir, latestBase+".down.sql"),
	}

	for _, path := range files {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("stat %s: %v", filepath.Base(path), err)
		}
		if info.Size() == 0 {
			t.Fatalf("migration %s is empty", filepath.Base(path))
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
	expectedVersion, _ := latestMigrationVersion(t)
	if version != expectedVersion {
		t.Fatalf("expected migration version %d, got %d", expectedVersion, version)
	}
}
