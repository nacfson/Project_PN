package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	SignInShared          = "shared"
	SignInNone            = "none"
	DefaultGatewayAuthURL = "http://gateway.identity.svc:8080/auth"
)

// GatewayClient handles session confirmation with the platform gateway over the cluster network.
type GatewayClient struct {
	gatewayURL string
	httpClient *http.Client
	signInMode string
}

// NewGatewayClient creates a new GatewayClient.
func NewGatewayClient(gatewayURL, signInMode string, httpClient *http.Client) *GatewayClient {
	if gatewayURL == "" {
		gatewayURL = DefaultGatewayAuthURL
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 5 * time.Second}
	}
	return &GatewayClient{
		gatewayURL: gatewayURL,
		httpClient: httpClient,
		signInMode: signInMode,
	}
}

// SignInMode returns the configured declaration ("shared" or "none").
func (c *GatewayClient) SignInMode() string {
	return c.signInMode
}

// ConfirmedIdentity represents a validated visitor identity (issuer, subject) for this project's audience.
type ConfirmedIdentity struct {
	Subject  string
	Issuer   string
	Audience string
	Token    string
}

type jwtPayload struct {
	Issuer    string      `json:"iss"`
	Subject   string      `json:"sub"`
	Audience  interface{} `json:"aud"`
	ExpiresAt int64       `json:"exp"`
}

func (p *jwtPayload) matchesAudience(target string) bool {
	switch v := p.Audience.(type) {
	case string:
		return v == target
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok && s == target {
				return true
			}
		}
	case []string:
		for _, s := range v {
			if s == target {
				return true
			}
		}
	}
	return false
}

// DeriveProjectAudience derives the project audience from its hostname.
// For pn.example.com or pn.nacfson.cloud, the audience is project-pn.
func DeriveProjectAudience(host string) string {
	if strings.Contains(host, ":") {
		host, _, _ = net.SplitHostPort(host)
	}
	host = strings.TrimSpace(strings.ToLower(host))
	subdomain := strings.Split(host, ".")[0]
	if subdomain == "pn" {
		return "project-pn"
	}
	return "project-" + subdomain
}

// ConfirmIdentity asks the gateway over the cluster network at http://gateway.identity.svc:8080/auth
// whether the session is confirmed.
// When signIn is none or omitted, or when the cookie is missing/invalid or service is unreachable,
// it returns nil, nil leaving the visitor unsigned-in.
func (c *GatewayClient) ConfirmIdentity(ctx context.Context, host string, cookies []*http.Cookie) (*ConfirmedIdentity, error) {
	// A project with signIn omitted or none must not start sign-in, must not call the gateway,
	// and must not treat a presented claim as a user.
	if c.signInMode != SignInShared {
		return nil, nil
	}

	if len(cookies) == 0 {
		return nil, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.gatewayURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-Forwarded-Host", host)
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// An unreachable sign-in service leaves that part unsigned-in
		return nil, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Missing cookie, rejected or expired session, or session for another project
		return nil, nil
	}

	authHeader := resp.Header.Get("Authorization")
	subject := resp.Header.Get("X-User-Subject")
	issuer := resp.Header.Get("X-User-Issuer")

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, nil
	}
	token := strings.TrimSpace(authHeader[7:])

	expectedAudience := DeriveProjectAudience(host)

	// Validate JWT structure, issuer, audience, and expiry
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return nil, nil
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		payloadBytes, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, nil
		}
	}

	var claims jwtPayload
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, nil
	}

	// Expiry check
	if claims.ExpiresAt > 0 && time.Now().Unix() >= claims.ExpiresAt {
		return nil, nil
	}

	// Audience check
	if !claims.matchesAudience(expectedAudience) {
		return nil, nil
	}

	// Issuer check
	if issuer != "" && claims.Issuer != "" && claims.Issuer != issuer {
		return nil, nil
	}

	// Subject check
	if subject != "" && claims.Subject != "" && claims.Subject != subject {
		return nil, nil
	}

	sub := claims.Subject
	if sub == "" {
		sub = subject
	}
	iss := claims.Issuer
	if iss == "" {
		iss = issuer
	}

	if sub == "" {
		return nil, errors.New("empty subject in confirmed identity")
	}

	return &ConfirmedIdentity{
		Subject:  sub,
		Issuer:   iss,
		Audience: expectedAudience,
		Token:    token,
	}, nil
}
