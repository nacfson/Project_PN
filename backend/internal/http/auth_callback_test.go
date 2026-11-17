package httpapi

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"project-pn/internal/auth"
	"project-pn/internal/logx"
)

func TestAuthCallback_ProvisioningFailure_Returns503AndLogsErrorWithTraceID(t *testing.T) {
	payloadJSON, _ := json.Marshal(map[string]any{
		"iss":   "https://auth.nacfson.cloud/realms/platform",
		"sub":   "sub-callback-fail",
		"aud":   "project-pn",
		"email": "fail@example.com",
		"exp":   time.Now().Add(10 * time.Minute).Unix(),
	})
	fakeJWT := "eyJhbGciOiJub25lIn0." + base64.RawURLEncoding.EncodeToString(payloadJSON) + ".sig"

	gwSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/exchange"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(auth.ExchangeResponse{
				SessionHandle: "v1.test-handle",
				Subject:       "sub-callback-fail",
				Issuer:        "https://auth.nacfson.cloud/realms/platform",
				Audience:      "project-pn",
				ExpiresIn:     3600,
			})
		case r.Method == http.MethodGet:
			w.Header().Set("Authorization", "Bearer "+fakeJWT)
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer gwSrv.Close()

	prevDefault := slog.Default()
	t.Cleanup(func() { slog.SetDefault(prevDefault) })

	var logBuf bytes.Buffer
	slog.SetDefault(logx.New(&logBuf, "pn-api", "v0.0.0-test"))

	adminLogger := &fakeLogger{}
	// nil pool forces EnsurePlatformUser to fail persistently.
	svc := auth.New(nil, auth.Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
	})
	gwClient := auth.NewGatewayClient(gwSrv.URL, auth.SignInShared, gwSrv.Client())
	h := newAuthHandler(svc, gwClient, nil, "https://pn.nacfson.cloud", "https://auth.nacfson.cloud", adminLogger)

	nonce := "test-nonce-value"
	sum := sha256.Sum256([]byte(nonce))
	bind := base64.RawURLEncoding.EncodeToString(sum[:])

	traceID := "0123456789abcdef0123456789abcdef"
	req := httptest.NewRequest(http.MethodGet, "/api/auth/callback?ticket=test-ticket&pa_bind="+bind, nil)
	req = req.WithContext(logx.WithTraceID(req.Context(), traceID))
	req.Host = "pn.nacfson.cloud"
	req.AddCookie(&http.Cookie{Name: loginCSRFNonceCookie, Value: nonce})

	rec := httptest.NewRecorder()
	h.callback(rec, req)

	if rec.Code == http.StatusFound {
		t.Fatalf("callback must NOT redirect as signed in when provisioning fails; got 302 to %q", rec.Header().Get("Location"))
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable on provisioning failure, got %d", rec.Code)
	}
	if loc := rec.Header().Get("Location"); loc != "" {
		t.Fatalf("expected empty Location header, got %q", loc)
	}
	if !adminLogger.has("AUTH_FAILURE", "ensure platform user on callback failed") {
		t.Fatalf("expected AUTH_FAILURE admin log, got %+v", adminLogger.entries())
	}

	var logged map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(logBuf.Bytes()), &logged); err != nil {
		t.Fatalf("unmarshal slog line %q: %v", logBuf.String(), err)
	}
	// logx keeps slog's level names (see logx_test.go); the admin stream is lowercase.
	if logged["level"] != "ERROR" {
		t.Fatalf("expected slog level=ERROR, got %v", logged["level"])
	}
	if logged["category"] != "AUTH_FAILURE" {
		t.Fatalf("expected category=AUTH_FAILURE, got %v", logged["category"])
	}
	if logged["trace_id"] != traceID {
		t.Fatalf("expected trace_id=%q, got %v", traceID, logged["trace_id"])
	}
}
