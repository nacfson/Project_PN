package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jws"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

type tokenOptions struct {
	issuer    string
	audience  string
	subject   string
	email     string
	provider  string
	typ       string
	headerTyp string
	expiry    time.Time
	keyID     string
	key       *rsa.PrivateKey
	alg       jwa.KeyAlgorithm
}

func mintTestToken(t *testing.T, opts tokenOptions) string {
	t.Helper()

	builder := jwt.NewBuilder().
		Issuer(opts.issuer).
		Audience([]string{opts.audience}).
		Subject(opts.subject).
		Expiration(opts.expiry).
		IssuedAt(time.Now().Add(-1 * time.Minute))

	if opts.email != "" {
		builder.Claim("email", opts.email)
	}
	if opts.provider != "" {
		builder.Claim("identity_provider", opts.provider)
	}
	if opts.typ != "" {
		builder.Claim("typ", opts.typ)
	}

	tok, err := builder.Build()
	if err != nil {
		t.Fatalf("failed to build token: %v", err)
	}

	headers := jws.NewHeaders()
	if opts.keyID != "" {
		_ = headers.Set("kid", opts.keyID)
	}
	if opts.headerTyp != "" {
		_ = headers.Set("typ", opts.headerTyp)
	}

	signAlg := opts.alg
	if signAlg == nil {
		signAlg = jwa.RS256()
	}

	signed, err := jwt.Sign(tok, jwt.WithKey(signAlg, opts.key, jws.WithProtectedHeaders(headers)))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return string(signed)
}

func TestJWTVerifier(t *testing.T) {
	ctx := context.Background()

	// Generate primary test RSA key
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate test RSA key: %v", err)
	}

	pubJWK, err := jwk.Import(privKey.Public())
	if err != nil {
		t.Fatalf("failed to import public key: %v", err)
	}
	_ = pubJWK.Set(jwk.KeyIDKey, "test-kid-1")
	_ = pubJWK.Set(jwk.AlgorithmKey, jwa.RS256())

	keySet := jwk.NewSet()
	_ = keySet.AddKey(pubJWK)

	cfg := JWTVerifierConfig{
		Issuer:      "https://auth.nacfson.cloud/realms/platform",
		Audience:    "project-pn",
		AllowedAlgs: []string{"RS256"},
		ClockSkew:   1 * time.Minute,
	}

	verifier := NewJWTVerifier(cfg)
	verifier.SetStaticJWKS(keySet)

	defaultOpts := tokenOptions{
		issuer:    cfg.Issuer,
		audience:  cfg.Audience,
		subject:   "user-sub-1234",
		email:     "learner@project-pn.local",
		provider:  "google",
		typ:       "Bearer",
		headerTyp: "JWT",
		expiry:    time.Now().Add(10 * time.Minute),
		keyID:     "test-kid-1",
		key:       privKey,
		alg:       jwa.RS256(),
	}

	t.Run("Valid project access token accepted", func(t *testing.T) {
		tokenStr := mintTestToken(t, defaultOpts)
		claims, err := verifier.Verify(ctx, tokenStr)
		if err != nil {
			t.Fatalf("expected valid token to pass, got err: %v", err)
		}
		if claims.Subject != "user-sub-1234" {
			t.Errorf("expected subject user-sub-1234, got %s", claims.Subject)
		}
		if claims.Issuer != cfg.Issuer {
			t.Errorf("expected issuer %s, got %s", cfg.Issuer, claims.Issuer)
		}
		if claims.Email != "learner@project-pn.local" {
			t.Errorf("expected email learner@project-pn.local, got %s", claims.Email)
		}
		if claims.SignInMethod != "google" {
			t.Errorf("expected sign_in_method google, got %s", claims.SignInMethod)
		}
	})

	t.Run("Missing or empty token rejected", func(t *testing.T) {
		_, err := verifier.Verify(ctx, "")
		if !errors.Is(err, ErrMissingToken) {
			t.Errorf("expected ErrMissingToken, got %v", err)
		}

		_, err = verifier.Verify(ctx, "   ")
		if !errors.Is(err, ErrMissingToken) {
			t.Errorf("expected ErrMissingToken, got %v", err)
		}
	})

	t.Run("Wrong audience rejected", func(t *testing.T) {
		opts := defaultOpts
		opts.audience = "other-service-client"
		tokenStr := mintTestToken(t, opts)

		_, err := verifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrInvalidAudience) {
			t.Errorf("expected ErrInvalidAudience, got %v", err)
		}
	})

	t.Run("Wrong issuer rejected", func(t *testing.T) {
		opts := defaultOpts
		opts.issuer = "https://untrusted-auth.com/realms/rogue"
		tokenStr := mintTestToken(t, opts)

		_, err := verifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrInvalidIssuer) {
			t.Errorf("expected ErrInvalidIssuer, got %v", err)
		}
	})

	t.Run("Bad signature rejected", func(t *testing.T) {
		otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			t.Fatalf("failed to generate rogue key: %v", err)
		}
		opts := defaultOpts
		opts.key = otherKey
		tokenStr := mintTestToken(t, opts)

		_, err = verifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrInvalidSignature) {
			t.Errorf("expected ErrInvalidSignature, got %v", err)
		}
	})

	t.Run("Expired token rejected", func(t *testing.T) {
		opts := defaultOpts
		opts.expiry = time.Now().Add(-5 * time.Minute)
		tokenStr := mintTestToken(t, opts)

		_, err := verifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrTokenExpired) {
			t.Errorf("expected ErrTokenExpired, got %v", err)
		}
	})

	t.Run("OIDC ID token rejected", func(t *testing.T) {
		// Header typ = "ID"
		opts := defaultOpts
		opts.headerTyp = "ID"
		tokenStr := mintTestToken(t, opts)
		_, err := verifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrInvalidTokenType) {
			t.Errorf("expected ErrInvalidTokenType, got %v", err)
		}

		// Payload typ = "ID"
		opts = defaultOpts
		opts.typ = "ID"
		tokenStr = mintTestToken(t, opts)
		_, err = verifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrInvalidTokenType) {
			t.Errorf("expected ErrInvalidTokenType, got %v", err)
		}
	})

	t.Run("Missing subject rejected", func(t *testing.T) {
		opts := defaultOpts
		opts.subject = ""
		tokenStr := mintTestToken(t, opts)

		_, err := verifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrMissingSubject) {
			t.Errorf("expected ErrMissingSubject, got %v", err)
		}
	})

	t.Run("JWKS key rotation and refresh via HTTP", func(t *testing.T) {
		rotatedKey, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			t.Fatalf("failed to generate rotated key: %v", err)
		}
		rotatedJWK, err := jwk.Import(rotatedKey.Public())
		if err != nil {
			t.Fatalf("failed to import rotated key: %v", err)
		}
		_ = rotatedJWK.Set(jwk.KeyIDKey, "rotated-kid-2")
		_ = rotatedJWK.Set(jwk.AlgorithmKey, jwa.RS256())

		serverSet := jwk.NewSet()
		_ = serverSet.AddKey(pubJWK)
		_ = serverSet.AddKey(rotatedJWK)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(serverSet)
		}))
		defer ts.Close()

		rotVerifier := NewJWTVerifier(JWTVerifierConfig{
			Issuer:      cfg.Issuer,
			Audience:    cfg.Audience,
			JWKSURL:     ts.URL,
			AllowedAlgs: []string{"RS256"},
		})
		// Initialize with only initial key
		rotVerifier.SetStaticJWKS(keySet)

		// Sign with new rotated key id
		opts := defaultOpts
		opts.key = rotatedKey
		opts.keyID = "rotated-kid-2"
		tokenStr := mintTestToken(t, opts)

		// Should refresh from server and succeed
		claims, err := rotVerifier.Verify(ctx, tokenStr)
		if err != nil {
			t.Fatalf("expected rotation verify to succeed after refresh, got err: %v", err)
		}
		if claims.Subject != defaultOpts.subject {
			t.Errorf("expected subject %s, got %s", defaultOpts.subject, claims.Subject)
		}
	})

	t.Run("JWKS unreachable fails closed", func(t *testing.T) {
		brokenVerifier := NewJWTVerifier(JWTVerifierConfig{
			Issuer:      cfg.Issuer,
			Audience:    cfg.Audience,
			JWKSURL:     "http://127.0.0.1:59999/unreachable-jwks",
			AllowedAlgs: []string{"RS256"},
		})
		tokenStr := mintTestToken(t, defaultOpts)

		_, err := brokenVerifier.Verify(ctx, tokenStr)
		if !errors.Is(err, ErrJWKSUnavailable) {
			t.Errorf("expected ErrJWKSUnavailable, got %v", err)
		}
	})
}
