package migrations

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"project-pn/internal/db"
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

func TestMultiwordPosPhraseMigrationHandlesConflictingPOS(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for migration smoke tests")
	}

	migrationsPath := "file://" + repoPath(t, "db", "migrations")
	if err := Up(migrationsPath, databaseURL); err != nil {
		t.Fatalf("ensure up to date: %v", err)
	}

	// Roll back past the phrase retag migrations (000025 and 000026) to version 24,
	// then seed conflicting multi-word POS rows and re-apply so 000025/000026 must not hit words_identity_unique.
	latestVersion, _ := latestMigrationVersion(t)
	if latestVersion > 24 {
		if err := Down(migrationsPath, databaseURL, int(latestVersion-24)); err != nil {
			t.Fatalf("down before seed: %v", err)
		}
	}

	ctx := context.Background()
	pool, err := db.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer pool.Close()

	lemma := "in which migrate " + strconv.FormatInt(time.Now().UnixNano(), 10)
	if _, err := pool.Exec(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values
			('en', $1, $1, 'noun'),
			('en', $1, $1, 'pronoun')
	`, lemma); err != nil {
		t.Fatalf("seed conflicting multi-word rows: %v", err)
	}

	if err := Up(migrationsPath, databaseURL); err != nil {
		t.Fatalf("up after conflicting seed: %v", err)
	}

	var phraseCount, otherCount int
	if err := pool.QueryRow(ctx, `
		select
			count(*) filter (where part_of_speech = 'phrase'),
			count(*) filter (where part_of_speech <> 'phrase')
		from words
		where language_code = 'en' and normalized_text = $1
	`, lemma).Scan(&phraseCount, &otherCount); err != nil {
		t.Fatalf("count retagged rows: %v", err)
	}
	if phraseCount != 1 {
		t.Fatalf("expected exactly 1 phrase row, got phrase=%d other=%d", phraseCount, otherCount)
	}
	if otherCount != 1 {
		t.Fatalf("expected 1 non-phrase sibling left intact, got phrase=%d other=%d", phraseCount, otherCount)
	}
}
