package analytics

import (
	"encoding/json"
	"io"
	"os"
	"sync"
)

// Logger writes one structured record per event. Implementations must never
// panic or return an error to a product request path.
type Logger interface {
	Emit(Record)
}

type NoopLogger struct{}

func (NoopLogger) Emit(Record) {}

type JSONLogger struct {
	mu  sync.Mutex
	out io.Writer
}

func NewJSONLogger(out io.Writer) *JSONLogger {
	if out == nil {
		out = os.Stdout
	}
	return &JSONLogger{out: out}
}

func (l *JSONLogger) Emit(record Record) {
	defer func() { _ = recover() }()
	l.mu.Lock()
	defer l.mu.Unlock()
	_ = json.NewEncoder(l.out).Encode(record)
}

var _ Logger = NoopLogger{}
var _ Logger = (*JSONLogger)(nil)
