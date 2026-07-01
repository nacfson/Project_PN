package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"project-pn/internal/auth"
)

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
