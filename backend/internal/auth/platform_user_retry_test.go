package auth

import (
	"context"
	"database/sql/driver"
	"errors"
	"io"
	"net"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type fakeRow struct {
	scanFn func(dest ...any) error
}

func (r fakeRow) Scan(dest ...any) error {
	return r.scanFn(dest...)
}

type fakeTx struct {
	userID    string
	commitErr error
}

func (t *fakeTx) Begin(ctx context.Context) (pgx.Tx, error) { return t, nil }
func (t *fakeTx) Commit(ctx context.Context) error          { return t.commitErr }
func (t *fakeTx) Rollback(ctx context.Context) error        { return nil }
func (t *fakeTx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (t *fakeTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults { return nil }
func (t *fakeTx) LargeObjects() pgx.LargeObjects                               { return pgx.LargeObjects{} }
func (t *fakeTx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (t *fakeTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (t *fakeTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}
func (t *fakeTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return fakeRow{
		scanFn: func(dest ...any) error {
			if p, ok := dest[0].(*string); ok {
				*p = t.userID
			}
			return nil
		},
	}
}
func (t *fakeTx) Conn() *pgx.Conn { return nil }

type fakeBeginner struct {
	beginFn func(attempt int) (pgx.Tx, error)
	calls   int
}

func (b *fakeBeginner) Begin(ctx context.Context) (pgx.Tx, error) {
	b.calls++
	return b.beginFn(b.calls)
}

func TestEnsurePlatformUser_RetriesOnceOnBeginUnexpectedEOF(t *testing.T) {
	svc := New(nil, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
	})
	fb := &fakeBeginner{
		beginFn: func(attempt int) (pgx.Tx, error) {
			if attempt == 1 {
				return nil, io.ErrUnexpectedEOF
			}
			return &fakeTx{userID: "user-123"}, nil
		},
	}

	res, err := svc.ensurePlatformUserWithBeginner(context.Background(), fb, "https://auth.nacfson.cloud/realms/platform", "sub-1", "a@example.com", "google")
	if err != nil {
		t.Fatalf("expected retry to succeed, got error: %v", err)
	}
	if fb.calls != 2 {
		t.Fatalf("expected exactly 2 Begin attempts (initial + 1 retry), got %d", fb.calls)
	}
	if res.User.ID != "user-123" {
		t.Fatalf("expected user ID user-123, got %q", res.User.ID)
	}
}

func TestEnsurePlatformUser_DoesNotLoopPastOneRetry(t *testing.T) {
	svc := New(nil, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
	})
	fb := &fakeBeginner{
		beginFn: func(attempt int) (pgx.Tx, error) {
			return nil, io.ErrUnexpectedEOF
		},
	}

	_, err := svc.ensurePlatformUserWithBeginner(context.Background(), fb, "https://auth.nacfson.cloud/realms/platform", "sub-1", "a@example.com", "google")
	if err == nil {
		t.Fatal("expected error when both attempts fail")
	}
	if fb.calls != 2 {
		t.Fatalf("expected exactly 2 Begin attempts (no retry loop), got %d", fb.calls)
	}
}

func TestEnsurePlatformUser_NeverRetriesAfterCommitSent(t *testing.T) {
	svc := New(nil, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
	})
	fb := &fakeBeginner{
		beginFn: func(attempt int) (pgx.Tx, error) {
			return &fakeTx{userID: "user-123", commitErr: io.ErrUnexpectedEOF}, nil
		},
	}

	_, err := svc.ensurePlatformUserWithBeginner(context.Background(), fb, "https://auth.nacfson.cloud/realms/platform", "sub-1", "a@example.com", "google")
	if err == nil {
		t.Fatal("expected commit error")
	}
	if fb.calls != 1 {
		t.Fatalf("expected exactly 1 attempt (never retry after Commit), got %d", fb.calls)
	}
}

func TestIsPreCommitConnError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"unexpected EOF", io.ErrUnexpectedEOF, true},
		{"net closed", net.ErrClosed, true},
		{"driver bad conn", driver.ErrBadConn, true},
		{"sqlstate 08006", &pgconn.PgError{Code: "08006"}, true},
		{"context canceled", context.Canceled, false},
		{"no rows", pgx.ErrNoRows, false},
		{"generic constraint", errors.New("duplicate key"), false},
	}
	for _, tc := range cases {
		if got := isPreCommitConnError(tc.err); got != tc.want {
			t.Errorf("%s: got %v, want %v", tc.name, got, tc.want)
		}
	}
}
