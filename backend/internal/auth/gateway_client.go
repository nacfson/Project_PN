package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
		gatewayURL: strings.TrimRight(gatewayURL, "/"),
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
	Email    string
	Token    string
}

// ExchangeResponse represents the payload returned by POST /auth/exchange on the internal gateway.
type ExchangeResponse struct {
	SessionHandle string `json:"session_handle"`
	Subject       string `json:"subject"`
	Issuer        string `json:"issuer"`
	Audience      string `json:"audience"`
	ExpiresIn     int64  `json:"expires_in"`
}

type jwtPayload struct {
	Issuer    string      `json:"iss"`
	Subject   string      `json:"sub"`
	Audience  interface{} `json:"aud"`
	Email     string      `json:"email"`
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

func normalizeGatewayHost(host string) string {
	h := host
	if strings.Contains(h, ":") {
		if splitHost, _, err := net.SplitHostPort(h); err == nil {
			h = splitHost
		}
	}
	h = strings.TrimSpace(strings.ToLower(h))
	if h == "" || h == "localhost" || h == "127.0.0.1" || h == "example.com" ||
		!strings.Contains(h, ".") || strings.HasSuffix(h, ".svc") ||
		strings.HasSuffix(h, ".cluster.local") || strings.HasPrefix(h, "pn-backend") ||
		strings.HasPrefix(h, "pn-frontend") {
		return "pn.nacfson.cloud"
	}
	return h
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

	effectiveHost := normalizeGatewayHost(host)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.gatewayURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-Forwarded-Host", effectiveHost)
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

	ident, _, err := parseConfirmedIdentityResponse(resp, effectiveHost)
	return ident, err
}

// ConfirmSessionHandle confirms a sealed v1.<session_handle> with the internal platform gateway
// via GET /auth and returns the confirmed identity and optional X-Refreshed-Session-Handle.
func (c *GatewayClient) ConfirmSessionHandle(ctx context.Context, host, sessionHandle string) (*ConfirmedIdentity, string, error) {
	if c.signInMode != SignInShared {
		return nil, "", errors.New("gateway sign-in mode disabled")
	}
	sessionHandle = strings.TrimSpace(sessionHandle)
	if !strings.HasPrefix(sessionHandle, "v1.") {
		return nil, "", errors.New("invalid session handle prefix")
	}

	effectiveHost := normalizeGatewayHost(host)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.gatewayURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+sessionHandle)
	req.Header.Set("X-Forwarded-Host", effectiveHost)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("gateway rejected session handle with status %d", resp.StatusCode)
	}

	ident, refreshed, err := parseConfirmedIdentityResponse(resp, effectiveHost)
	if err != nil {
		return nil, "", err
	}
	if ident == nil {
		return nil, "", errors.New("gateway returned invalid identity claims")
	}
	return ident, refreshed, nil
}

// ExchangeTicket exchanges a single-use v1.<ticket> with the internal platform gateway
// via POST /auth/exchange for a sealed v1.<session_handle>.
func (c *GatewayClient) ExchangeTicket(ctx context.Context, host, ticket string) (*ExchangeResponse, error) {
	if c.signInMode != SignInShared {
		return nil, errors.New("gateway sign-in mode disabled")
	}
	ticket = strings.TrimSpace(ticket)
	if ticket == "" {
		return nil, errors.New("empty ticket")
	}

	payload, err := json.Marshal(map[string]string{"ticket": ticket})
	if err != nil {
		return nil, err
	}

	exchangeURL := c.gatewayURL + "/exchange"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, exchangeURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-Host", normalizeGatewayHost(host))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gateway ticket exchange failed with status %d", resp.StatusCode)
	}

	var exch ExchangeResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16<<10)).Decode(&exch); err != nil {
		return nil, err
	}
	if !strings.HasPrefix(exch.SessionHandle, "v1.") || exch.Subject == "" || exch.Issuer == "" {
		return nil, errors.New("invalid exchange response from gateway")
	}
	if exch.ExpiresIn <= 0 {
		exch.ExpiresIn = 28800
	}
	return &exch, nil
}

// LogoutSessionHandle revokes a sealed v1.<session_handle> at the internal platform gateway
// via POST /auth/logout.
func (c *GatewayClient) LogoutSessionHandle(ctx context.Context, sessionHandle string) error {
	sessionHandle = strings.TrimSpace(sessionHandle)
	if !strings.HasPrefix(sessionHandle, "v1.") {
		return ErrInvalidToken
	}

	logoutURL := c.gatewayURL + "/logout"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, logoutURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+sessionHandle)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return ErrInvalidToken
	}
	return nil
}

func parseConfirmedIdentityResponse(resp *http.Response, host string) (*ConfirmedIdentity, string, error) {
	authHeader := resp.Header.Get("Authorization")
	subject := strings.TrimSpace(resp.Header.Get("X-User-Subject"))
	issuer := strings.TrimSpace(resp.Header.Get("X-User-Issuer"))
	emailHeader := strings.TrimSpace(resp.Header.Get("X-User-Email"))
	audienceHeader := strings.TrimSpace(resp.Header.Get("X-Project-Audience"))
	refreshedHandle := strings.TrimSpace(resp.Header.Get("X-Refreshed-Session-Handle"))

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, "", nil
	}
	token := strings.TrimSpace(authHeader[7:])

	expectedAudience := DeriveProjectAudience(host)

	// Validate JWT structure, issuer, audience, and expiry
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return nil, "", nil
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		payloadBytes, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, "", nil
		}
	}

	var claims jwtPayload
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, "", nil
	}

	// Expiry check
	if claims.ExpiresAt > 0 && time.Now().Unix() >= claims.ExpiresAt {
		return nil, "", nil
	}

	// Audience check: trust the Gateway verified X-Project-Audience header, or fall back to JWT aud claim
	if audienceHeader != "" {
		if audienceHeader != expectedAudience {
			return nil, "", nil
		}
	} else if !claims.matchesAudience(expectedAudience) {
		return nil, "", nil
	}

	// Subject check
	if subject != "" && claims.Subject != "" && claims.Subject != subject {
		return nil, "", nil
	}

	sub := subject
	if sub == "" {
		sub = claims.Subject
	}
	iss := issuer
	if iss == "" {
		iss = claims.Issuer
	}

	if sub == "" {
		return nil, "", errors.New("empty subject in confirmed identity")
	}

	email := emailHeader
	if email == "" {
		email = strings.TrimSpace(claims.Email)
	}

	return &ConfirmedIdentity{
		Subject:  sub,
		Issuer:   iss,
		Audience: expectedAudience,
		Email:    email,
		Token:    token,
	}, refreshedHandle, nil
}
