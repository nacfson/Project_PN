package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"project-pn/internal/admin"
	"project-pn/internal/auth"
)

// logLine captures a single admin log entry.
type logLine struct {
	Category string
	Message  string
}

// fakeLogger implements admin.Logger and records every emitted log line.
type fakeLogger struct {
	mu    sync.Mutex
	lines []logLine
}

func (f *fakeLogger) Log(category, message string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lines = append(f.lines, logLine{Category: category, Message: message})
}

func (f *fakeLogger) Logf(category, format string, args ...interface{}) {
	f.Log(category, fmt.Sprintf(format, args...))
}

func (f *fakeLogger) Close() error { return nil }

func (f *fakeLogger) has(category, substr string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, l := range f.lines {
		if l.Category == category && strings.Contains(l.Message, substr) {
			return true
		}
	}
	return false
}

func (f *fakeLogger) entries() []logLine {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]logLine, len(f.lines))
	copy(out, f.lines)
	return out
}

var _ admin.Logger = (*fakeLogger)(nil)

var (
	testSessionTokens = make(map[string]string)
	testSessionMutex  sync.RWMutex
)

func registerTestToken(token, email string) {
	testSessionMutex.Lock()
	defer testSessionMutex.Unlock()
	testSessionTokens[token] = email
}

func mockCentralClient(t *testing.T) *auth.CentralClient {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")

		testSessionMutex.RLock()
		email, exists := testSessionTokens[token]
		testSessionMutex.RUnlock()

		if !exists {
			if strings.HasPrefix(token, "token-") {
				email = strings.TrimPrefix(token, "token-")
			} else {
				email = token // fallback
			}
		}

		w.Header().Set("Content-Type", "application/json")
		centralID := "central-id-" + email
		w.Write([]byte(fmt.Sprintf(`{"expires_at":"2030-01-01T00:00:00Z","user":{"id":"%s","email":"%s","is_admin":false}}`, centralID, email)))
	}))
	t.Cleanup(srv.Close)
	return auth.NewCentralClient(srv.URL, nil)
}
