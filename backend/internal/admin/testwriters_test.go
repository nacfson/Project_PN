package admin

import "errors"

// Writers that fail on every write. Shared by logger and middleware tests.

type errWriter struct{}

func (errWriter) Write([]byte) (int, error) { return 0, errors.New("write failed") }

type panicWriter struct{}

func (panicWriter) Write([]byte) (int, error) { panic("write panic") }
