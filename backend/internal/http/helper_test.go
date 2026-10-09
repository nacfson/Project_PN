package httpapi

import (
	"crypto/rand"
	"crypto/rsa"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jws"
	"github.com/lestrrat-go/jwx/v3/jwt"

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

type testJWTFixture struct {
	Verifier *auth.JWTVerifier
	PrivKey  *rsa.PrivateKey
	Issuer   string
	Audience string
}

func setupTestJWTFixture(t *testing.T) testJWTFixture {
	t.Helper()

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	pubJWK, err := jwk.Import(privKey.Public())
	if err != nil {
		t.Fatalf("import jwk: %v", err)
	}
	_ = pubJWK.Set(jwk.KeyIDKey, "test-kid")
	_ = pubJWK.Set(jwk.AlgorithmKey, jwa.RS256())

	keySet := jwk.NewSet()
	_ = keySet.AddKey(pubJWK)

	cfg := auth.JWTVerifierConfig{
		Issuer:      "https://auth.nacfson.cloud/realms/platform",
		Audience:    "project-pn",
		AllowedAlgs: []string{"RS256"},
		ClockSkew:   1 * time.Minute,
	}

	verifier := auth.NewJWTVerifier(cfg)
	verifier.SetStaticJWKS(keySet)

	return testJWTFixture{
		Verifier: verifier,
		PrivKey:  privKey,
		Issuer:   cfg.Issuer,
		Audience: cfg.Audience,
	}
}

func (f testJWTFixture) MintToken(t *testing.T, sub, email string) string {
	t.Helper()

	builder := jwt.NewBuilder().
		Issuer(f.Issuer).
		Audience([]string{f.Audience}).
		Subject(sub).
		Expiration(time.Now().Add(1 * time.Hour)).
		IssuedAt(time.Now().Add(-1 * time.Minute)).
		Claim("typ", "Bearer")

	if email != "" {
		builder.Claim("email", email)
	}

	tok, err := builder.Build()
	if err != nil {
		t.Fatalf("build token: %v", err)
	}

	headers := jws.NewHeaders()
	_ = headers.Set("kid", "test-kid")
	_ = headers.Set("typ", "JWT")

	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.RS256(), f.PrivKey, jws.WithProtectedHeaders(headers)))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	return string(signed)
}

var (
	defaultTestJWTFixtureOnce sync.Once
	defaultTestJWTFixtureVal  testJWTFixture
)

func defaultJWTFixture(t *testing.T) testJWTFixture {
	t.Helper()
	defaultTestJWTFixtureOnce.Do(func() {
		defaultTestJWTFixtureVal = setupTestJWTFixture(t)
	})
	return defaultTestJWTFixtureVal
}

