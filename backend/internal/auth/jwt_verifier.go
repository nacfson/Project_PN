package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jws"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

var (
	ErrMissingToken     = errors.New("missing or empty bearer token")
	ErrInvalidSignature = errors.New("invalid token signature")
	ErrDisallowedAlg    = errors.New("disallowed signature algorithm")
	ErrInvalidIssuer    = errors.New("invalid token issuer")
	ErrInvalidAudience  = errors.New("invalid token audience")
	ErrTokenExpired     = errors.New("token expired or not yet valid")
	ErrMissingSubject   = errors.New("missing or empty token subject")
	ErrInvalidTokenType = errors.New("invalid token type; access token required")
	ErrJWKSUnavailable  = errors.New("unable to retrieve JWKS trust material")
)

type JWTVerifierConfig struct {
	Issuer      string
	Audience    string
	JWKSURL     string
	AllowedAlgs []string
	ClockSkew   time.Duration
}

type VerifiedClaims struct {
	Issuer       string
	Subject      string
	Email        string
	SignInMethod string
}

type JWTVerifier struct {
	cfg        JWTVerifierConfig
	jwksSet    jwk.Set
	jwksMu     sync.RWMutex
	lastFetch  time.Time
	httpClient *http.Client
}

func NewJWTVerifier(cfg JWTVerifierConfig) *JWTVerifier {
	if cfg.ClockSkew <= 0 {
		cfg.ClockSkew = 1 * time.Minute
	}
	if len(cfg.AllowedAlgs) == 0 {
		cfg.AllowedAlgs = []string{"RS256"}
	}
	return &JWTVerifier{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SetStaticJWKS allows setting a fixed JWKS key set for tests.
func (v *JWTVerifier) SetStaticJWKS(set jwk.Set) {
	v.jwksMu.Lock()
	defer v.jwksMu.Unlock()
	v.jwksSet = set
}

// FetchJWKS forces or refreshes the JWKS key set from the configured URL.
func (v *JWTVerifier) FetchJWKS(ctx context.Context) (jwk.Set, error) {
	if v.cfg.JWKSURL == "" {
		return nil, ErrJWKSUnavailable
	}

	set, err := jwk.Fetch(ctx, v.cfg.JWKSURL, jwk.WithHTTPClient(v.httpClient))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrJWKSUnavailable, err)
	}

	v.jwksMu.Lock()
	v.jwksSet = set
	v.lastFetch = time.Now()
	v.jwksMu.Unlock()

	return set, nil
}

func (v *JWTVerifier) getJWKS(ctx context.Context, kid string) (jwk.Set, error) {
	v.jwksMu.RLock()
	set := v.jwksSet
	v.jwksMu.RUnlock()

	// If we already have a set, check if the required kid is present
	if set != nil {
		if kid == "" {
			return set, nil
		}
		if _, found := set.LookupKeyID(kid); found {
			return set, nil
		}
	}

	// If no set or kid is missing, try fetching from JWKSURL
	if v.cfg.JWKSURL != "" {
		return v.FetchJWKS(ctx)
	}

	if set != nil {
		return set, nil
	}
	return nil, ErrJWKSUnavailable
}

// Verify validates a project-scoped access token and returns verified identity claims.
func (v *JWTVerifier) Verify(ctx context.Context, tokenString string) (*VerifiedClaims, error) {
	tokenString = strings.TrimSpace(tokenString)
	if tokenString == "" {
		return nil, ErrMissingToken
	}

	// 1. Inspect JWS headers before verification to enforce alg allowlist and reject ID tokens
	msg, err := jws.Parse([]byte(tokenString))
	if err != nil || len(msg.Signatures()) == 0 {
		return nil, ErrInvalidSignature
	}

	sig := msg.Signatures()[0]
	alg, ok := sig.ProtectedHeaders().Algorithm()
	if !ok {
		return nil, ErrDisallowedAlg
	}
	algStr := alg.String()
	if strings.EqualFold(algStr, "none") || !slices.Contains(v.cfg.AllowedAlgs, algStr) {
		return nil, ErrDisallowedAlg
	}

	if typ, hasTyp := sig.ProtectedHeaders().Type(); hasTyp {
		if strings.EqualFold(typ, "ID") || strings.Contains(strings.ToUpper(typ), "ID_TOKEN") {
			return nil, ErrInvalidTokenType
		}
	}

	kid, _ := sig.ProtectedHeaders().KeyID()

	// 2. Fetch / lookup JWKS trust material
	keySet, err := v.getJWKS(ctx, kid)
	if err != nil {
		return nil, err
	}

	// 3. Cryptographically verify and parse JWT
	tok, err := jwt.Parse(
		[]byte(tokenString),
		jwt.WithKeySet(keySet),
		jwt.WithValidate(true),
		jwt.WithIssuer(v.cfg.Issuer),
		jwt.WithAudience(v.cfg.Audience),
		jwt.WithAcceptableSkew(v.cfg.ClockSkew),
	)
	if err != nil {
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "issuer") || strings.Contains(errStr, `"iss"`) {
			return nil, ErrInvalidIssuer
		}
		if strings.Contains(errStr, "audience") || strings.Contains(errStr, `"aud"`) {
			return nil, ErrInvalidAudience
		}
		if strings.Contains(errStr, "expired") || strings.Contains(errStr, `"exp"`) || strings.Contains(errStr, "not before") || strings.Contains(errStr, `"nbf"`) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidSignature
	}

	// 4. Verify Subject exists
	sub, ok := tok.Subject()
	if !ok || strings.TrimSpace(sub) == "" {
		return nil, ErrMissingSubject
	}

	// 5. Inspect payload token type claim (Keycloak puts "typ": "Bearer" for access tokens and "typ": "ID" for ID tokens)
	var payloadTyp string
	if err := tok.Get("typ", &payloadTyp); err == nil && payloadTyp != "" {
		if strings.EqualFold(payloadTyp, "ID") {
			return nil, ErrInvalidTokenType
		}
	}

	// 6. Extract informational email and identity provider
	var email string
	_ = tok.Get("email", &email)

	signInMethod := "google"
	var provider string
	if err := tok.Get("identity_provider", &provider); err == nil && provider != "" {
		providerLower := strings.ToLower(provider)
		if providerLower == "google" || providerLower == "apple" || providerLower == "email" {
			signInMethod = providerLower
		}
	}

	iss, _ := tok.Issuer()
	return &VerifiedClaims{
		Issuer:       iss,
		Subject:      sub,
		Email:        email,
		SignInMethod: signInMethod,
	}, nil
}
