package migrations

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"project-pn/internal/db"
)

func TestMVPSchemaAcceptance(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for schema acceptance tests")
	}

	ctx := context.Background()
	migrationsPath := "file://" + repoPath(t, "db", "migrations")

	if err := Down(migrationsPath, databaseURL, 1); err != nil {
		t.Fatalf("down migration before test: %v", err)
	}
	if err := Up(migrationsPath, databaseURL); err != nil {
		t.Fatalf("up migration: %v", err)
	}

	pool, err := db.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	assertRejects := func(name, query string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, query, args...); err == nil {
			t.Fatalf("%s: expected query to fail", name)
		}
	}

	var userA, userB, wordID, sensePayment, senseLegal, userSenseA, userSenseB string

	if err := pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language)
		values ('a@example.com', 'ko', 'en')
		returning id
	`).Scan(&userA); err != nil {
		t.Fatalf("insert user A: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language)
		values ('b@example.com', 'ko', 'en')
		returning id
	`).Scan(&userB); err != nil {
		t.Fatalf("insert user B: %v", err)
	}

	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', 'charge', 'charge', 'verb')
		returning id
	`).Scan(&wordID); err != nil {
		t.Fatalf("insert word: %v", err)
	}
	assertRejects("duplicate global word identity", `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', 'charge', 'charge', 'verb')
	`)

	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition_language_code, definition, meaning_order)
		values ($1, 'en', 'to ask someone to pay an amount of money', 1)
		returning id
	`, wordID).Scan(&sensePayment); err != nil {
		t.Fatalf("insert payment sense: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition_language_code, definition, meaning_order)
		values ($1, 'en', 'to accuse someone officially of a crime', 2)
		returning id
	`, wordID).Scan(&senseLegal); err != nil {
		t.Fatalf("insert legal sense: %v", err)
	}
	assertRejects("invalid CEFR", `
		insert into word_senses (word_id, definition_language_code, definition, cefr_level, meaning_order)
		values ($1, 'en', 'invalid level', 'Z9', 3)
	`, wordID)

	if err := pool.QueryRow(ctx, `
		insert into user_word_senses (user_id, word_sense_id)
		values ($1, $2)
		returning id
	`, userA, sensePayment).Scan(&userSenseA); err != nil {
		t.Fatalf("insert user A payment sense: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into user_word_senses (user_id, word_sense_id)
		values ($1, $2)
	`, userA, senseLegal); err != nil {
		t.Fatalf("same user can learn a second sense: %v", err)
	}
	assertRejects("duplicate user word sense", `
		insert into user_word_senses (user_id, word_sense_id)
		values ($1, $2)
	`, userA, sensePayment)
	assertRejects("invalid learning stage", `
		insert into user_word_senses (user_id, word_sense_id, learning_stage)
		values ($1, $2, 'done')
	`, userB, senseLegal)
	assertRejects("invalid difficulty rating", `
		insert into user_word_senses (user_id, word_sense_id, difficulty_rating)
		values ($1, $2, 6)
	`, userB, senseLegal)

	if err := pool.QueryRow(ctx, `
		insert into user_word_senses (user_id, word_sense_id)
		values ($1, $2)
		returning id
	`, userB, sensePayment).Scan(&userSenseB); err != nil {
		t.Fatalf("insert user B same sense: %v", err)
	}

	if _, err := pool.Exec(ctx, `
		insert into review_states (user_word_sense_id, due_at, interval_days)
		values ($1, now(), 1), ($2, now() + interval '3 days', 3)
	`, userSenseA, userSenseB); err != nil {
		t.Fatalf("insert independent review states: %v", err)
	}
	assertRejects("negative interval", `
		insert into review_states (user_word_sense_id, interval_days)
		values ($1, -1)
	`, userSenseA)

	if _, err := pool.Exec(ctx, `
		insert into review_attempts (user_word_sense_id, activity_type, prompt, user_answer, correct_answer, is_correct, review_rating, response_time_ms, confidence_rating)
		values ($1, 'cloze', 'Scientists need to _____ the results carefully.', 'analysis', 'analyze', false, 'again', 1500, 2)
	`, userSenseA); err != nil {
		t.Fatalf("insert review attempt: %v", err)
	}
	assertRejects("invalid review rating", `
		insert into review_attempts (user_word_sense_id, activity_type, review_rating)
		values ($1, 'cloze', 'later')
	`, userSenseA)
	assertRejects("invalid confidence rating", `
		insert into review_attempts (user_word_sense_id, activity_type, confidence_rating)
		values ($1, 'cloze', 6)
	`, userSenseA)
	assertRejects("negative response time", `
		insert into review_attempts (user_word_sense_id, activity_type, response_time_ms)
		values ($1, 'cloze', -1)
	`, userSenseA)

	if _, err := pool.Exec(ctx, `
		update review_states
		set due_at = now() + interval '1 day',
			interval_days = 1,
			ease_factor = 2.40,
			last_reviewed_at = now(),
			review_count = review_count + 1,
			lapse_count = lapse_count + 1,
			updated_at = now()
		where user_word_sense_id = $1
	`, userSenseA); err != nil {
		t.Fatalf("update review state: %v", err)
	}

	var attempts int
	if err := pool.QueryRow(ctx, `
		select count(*) from review_attempts where user_word_sense_id = $1
	`, userSenseA).Scan(&attempts); err != nil {
		t.Fatalf("count review attempts: %v", err)
	}
	if attempts != 1 {
		t.Fatalf("expected preserved review attempt, got %d", attempts)
	}

	if _, err := pool.Exec(ctx, `
		update user_word_senses
		set archived_at = $2, updated_at = now()
		where id = $1
	`, userSenseA, time.Now()); err != nil {
		t.Fatalf("archive user word sense: %v", err)
	}

	var dueCount int
	if err := pool.QueryRow(ctx, `
		select count(*)
		from review_states rs
		join user_word_senses uws on uws.id = rs.user_word_sense_id
		where rs.due_at <= now()
		  and uws.archived_at is null
	`).Scan(&dueCount); err != nil {
		t.Fatalf("query due count: %v", err)
	}
	if dueCount != 0 {
		t.Fatalf("expected archived due item to be excluded, got %d", dueCount)
	}
}

func TestAuthSchemaAcceptance(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for schema acceptance tests")
	}

	ctx := context.Background()
	migrationsPath := "file://" + repoPath(t, "db", "migrations")

	if err := Down(migrationsPath, databaseURL, 1); err != nil {
		t.Fatalf("down migration before auth test: %v", err)
	}
	if err := Up(migrationsPath, databaseURL); err != nil {
		t.Fatalf("up migration for auth: %v", err)
	}

	pool, err := db.Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	assertRejects := func(name, query string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, query, args...); err == nil {
			t.Fatalf("%s: expected query to fail", name)
		}
	}

	var userID string
	if err := pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language, password_hash)
		values ('auth-a@example.com', 'ko', 'en', 'hash')
		returning id
	`).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	assertRejects("duplicate email case-insensitive", `
		insert into users (email, native_language, target_language, password_hash)
		values ('AUTH-A@example.com', 'ko', 'en', 'hash2')
	`)

	var sessionID string
	if err := pool.QueryRow(ctx, `
		insert into sessions (user_id, token_hash, expires_at)
		values ($1, 'session-hash-a', now() + interval '1 hour')
		returning id
	`, userID).Scan(&sessionID); err != nil {
		t.Fatalf("insert session: %v", err)
	}
	assertRejects("duplicate session token hash", `
		insert into sessions (user_id, token_hash, expires_at)
		values ($1, 'session-hash-a', now() + interval '1 hour')
	`, userID)

	if _, err := pool.Exec(ctx, `delete from users where id = $1`, userID); err != nil {
		t.Fatalf("delete user cascade: %v", err)
	}
	var sessionCount int
	if err := pool.QueryRow(ctx, `select count(*) from sessions where id = $1`, sessionID).Scan(&sessionCount); err != nil {
		t.Fatalf("count sessions after cascade: %v", err)
	}
	if sessionCount != 0 {
		t.Fatalf("expected sessions cascade delete, got %d", sessionCount)
	}

	if err := pool.QueryRow(ctx, `
		insert into users (email, native_language, target_language, password_hash)
		values ('auth-b@example.com', 'ko', 'en', 'hash')
		returning id
	`).Scan(&userID); err != nil {
		t.Fatalf("reinsert user: %v", err)
	}

	var magicID string
	if err := pool.QueryRow(ctx, `
		insert into magic_link_tokens (user_id, token_hash, expires_at)
		values ($1, 'magic-hash-a', now() + interval '15 minutes')
		returning id
	`, userID).Scan(&magicID); err != nil {
		t.Fatalf("insert magic link token: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		update magic_link_tokens set consumed_at = now() where id = $1
	`, magicID); err != nil {
		t.Fatalf("consume magic link token: %v", err)
	}
	var consumedAt *time.Time
	if err := pool.QueryRow(ctx, `select consumed_at from magic_link_tokens where id = $1`, magicID).Scan(&consumedAt); err != nil {
		t.Fatalf("read consumed_at: %v", err)
	}
	if consumedAt == nil {
		t.Fatal("expected magic link consumed_at to be set")
	}

	var exchangeID string
	if err := pool.QueryRow(ctx, `
		insert into magic_login_exchanges (user_id, code_hash, expires_at)
		values ($1, 'exchange-hash-a', now() + interval '5 minutes')
		returning id
	`, userID).Scan(&exchangeID); err != nil {
		t.Fatalf("insert exchange: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		update magic_login_exchanges set consumed_at = now() where id = $1
	`, exchangeID); err != nil {
		t.Fatalf("consume exchange: %v", err)
	}
}

func repoPath(t *testing.T, parts ...string) string {
	t.Helper()

	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve current file")
	}

	root := filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
	pathParts := append([]string{root}, parts...)
	return filepath.Join(pathParts...)
}
