package auth

import (
	"context"
	"database/sql/driver"
	"errors"
	"io"
	"net"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type txBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// isPreCommitConnError reports whether err is a connection-class failure
// (unexpected EOF, closed net/driver conn, or SQLSTATE class 08) safe to
// retry once before a transaction commit has been sent.
func isPreCommitConnError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	if errors.Is(err, io.ErrUnexpectedEOF) ||
		errors.Is(err, io.EOF) ||
		errors.Is(err, net.ErrClosed) ||
		errors.Is(err, driver.ErrBadConn) {
		return true
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && strings.HasPrefix(pgErr.Code, "08") {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unexpected eof") ||
		strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "broken pipe") ||
		strings.Contains(msg, "server closed the connection unexpectedly") ||
		strings.Contains(msg, "conn closed")
}

// retryOncePreCommit runs fn and, if it fails before commit with a
// connection-class error (or a BEGIN failure), retries it exactly once.
// It never retries after commit was sent and never loops.
func retryOncePreCommit(ctx context.Context, fn func() (beginFailed bool, commitSent bool, err error)) error {
	beginFailed, commitSent, err := fn()
	if err == nil {
		return nil
	}
	if commitSent || ctx.Err() != nil {
		return err
	}
	if !beginFailed && !isPreCommitConnError(err) {
		return err
	}
	_, _, err = fn()
	return err
}
