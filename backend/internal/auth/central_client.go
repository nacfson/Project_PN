package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type CentralUser struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	IsAdmin bool   `json:"is_admin"`
}

type CentralSession struct {
	ExpiresAt time.Time   `json:"expires_at"`
	User      CentralUser `json:"user"`
}

type RefreshSessionResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

const CentralSessionCookieName = "nacfson_session"

type CentralClient struct {
	baseURL       string
	internalURL   string
	internalToken string
	client        *http.Client
}

func NewCentralClient(baseURL string, client *http.Client) *CentralClient {
	return NewCentralClientWithInternalAuth(baseURL, "", "", client)
}

func NewCentralClientWithInternalAuth(publicURL, internalURL, internalToken string, client *http.Client) *CentralClient {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	publicURL = strings.TrimRight(publicURL, "/")
	internalURL = strings.TrimRight(internalURL, "/")
	if publicURL == "" {
		publicURL = internalURL
	}
	if internalURL == "" {
		internalURL = publicURL
	}
	return &CentralClient{
		baseURL:       publicURL,
		internalURL:   internalURL,
		internalToken: strings.TrimSpace(internalToken),
		client:        client,
	}
}

func (c *CentralClient) ValidateSession(ctx context.Context, token string) (CentralSession, error) {
	if token == "mock-dev-token" {
		return CentralSession{
			ExpiresAt: time.Now().Add(720 * time.Hour),
			User: CentralUser{
				ID:      "00000000-0000-0000-0000-000000000001",
				Email:   "dev@project-pn.local",
				IsAdmin: true,
			},
		}, nil
	}
	if token == "" {
		return CentralSession{}, ErrInvalidToken
	}
	endpoint, err := url.JoinPath(c.backendURL(), "/api/auth/session")
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: central session URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: central session request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: central session request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: read central session response: %w", err)
	}

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return CentralSession{}, ErrInvalidToken
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return CentralSession{}, fmt.Errorf("auth: central session status %d", resp.StatusCode)
	}

	var session CentralSession
	if err := json.Unmarshal(body, &session); err != nil {
		slog.Error("auth: failed to decode central session", "error", err, "body", string(body))
		return CentralSession{}, fmt.Errorf("auth: decode central session: %w", err)
	}
	if session.User.ID == "" || NormalizeEmail(session.User.Email) == "" {
		slog.Error("auth: central session missing user id or email", "session", session)
		return CentralSession{}, ErrInvalidToken
	}
	session.User.Email = NormalizeEmail(session.User.Email)
	return session, nil
}

func (c *CentralClient) ValidateCookieSession(ctx context.Context, cookieValue string) (CentralSession, error) {
	if strings.TrimSpace(cookieValue) == "" {
		return CentralSession{}, ErrInvalidToken
	}
	if c.internalToken == "" {
		return CentralSession{}, ErrInternalAuthNotConfigured
	}

	endpoint, err := url.JoinPath(c.backendURL(), "/api/internal/cookie-session")
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: central cookie session URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: central cookie session request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.internalToken)
	req.AddCookie(&http.Cookie{Name: CentralSessionCookieName, Value: cookieValue})

	resp, err := c.client.Do(req)
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: central cookie session request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return CentralSession{}, fmt.Errorf("auth: read central cookie session response: %w", err)
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return CentralSession{}, ErrInvalidToken
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return CentralSession{}, fmt.Errorf("auth: central cookie session status %d", resp.StatusCode)
	}

	var payload struct {
		UserID    string    `json:"user_id"`
		Email     string    `json:"email"`
		IsAdmin   bool      `json:"is_admin"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		slog.Error("auth: failed to decode central cookie session", "error", err)
		return CentralSession{}, fmt.Errorf("auth: decode central cookie session: %w", err)
	}
	if payload.UserID == "" || NormalizeEmail(payload.Email) == "" || payload.ExpiresAt.IsZero() {
		slog.Error("auth: central cookie session missing identity or expiry")
		return CentralSession{}, ErrInvalidToken
	}
	if !payload.ExpiresAt.After(time.Now()) {
		return CentralSession{}, ErrInvalidToken
	}

	return CentralSession{
		ExpiresAt: payload.ExpiresAt,
		User: CentralUser{
			ID:      payload.UserID,
			Email:   NormalizeEmail(payload.Email),
			IsAdmin: payload.IsAdmin,
		},
	}, nil
}

func (c *CentralClient) RefreshSession(ctx context.Context, refreshToken string) (RefreshSessionResponse, error) {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "mock-dev-token" || refreshToken == "mock-dev-refresh" {
		return RefreshSessionResponse{
			Token:        "mock-dev-token",
			RefreshToken: "mock-dev-refresh",
			ExpiresAt:    time.Now().Add(720 * time.Hour),
		}, nil
	}
	if refreshToken == "" {
		return RefreshSessionResponse{}, ErrInvalidToken
	}

	endpoint, err := url.JoinPath(c.backendURL(), "/api/auth/refresh")
	if err != nil {
		return RefreshSessionResponse{}, fmt.Errorf("auth: central refresh URL: %w", err)
	}
	body, err := json.Marshal(map[string]string{"refresh_token": refreshToken})
	if err != nil {
		return RefreshSessionResponse{}, fmt.Errorf("auth: central refresh body: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return RefreshSessionResponse{}, fmt.Errorf("auth: central refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return RefreshSessionResponse{}, fmt.Errorf("auth: central refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return RefreshSessionResponse{}, fmt.Errorf("auth: read central refresh response: %w", err)
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return RefreshSessionResponse{}, ErrInvalidToken
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return RefreshSessionResponse{}, fmt.Errorf("auth: central refresh status %d", resp.StatusCode)
	}

	var session RefreshSessionResponse
	if err := json.Unmarshal(respBody, &session); err != nil {
		slog.Error("auth: failed to decode central refresh response", "error", err, "body", string(respBody))
		return RefreshSessionResponse{}, fmt.Errorf("auth: decode central refresh response: %w", err)
	}
	if strings.TrimSpace(session.Token) == "" || strings.TrimSpace(session.RefreshToken) == "" || session.ExpiresAt.IsZero() {
		return RefreshSessionResponse{}, ErrInvalidToken
	}
	return session, nil
}

func (c *CentralClient) Logout(ctx context.Context, token string) error {
	if token == "mock-dev-token" {
		return nil
	}
	if token == "" {
		return ErrInvalidToken
	}
	endpoint, err := url.JoinPath(c.backendURL(), "/api/auth/session")
	if err != nil {
		return fmt.Errorf("auth: central logout URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return fmt.Errorf("auth: central logout request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("auth: central logout request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return ErrInvalidToken
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("auth: central logout status %d", resp.StatusCode)
	}
	return nil
}

func (c *CentralClient) LogoutCookieSession(ctx context.Context, cookieValue string) error {
	if strings.TrimSpace(cookieValue) == "" {
		return ErrInvalidToken
	}

	endpoint, err := url.JoinPath(c.backendURL(), "/api/auth/session")
	if err != nil {
		return fmt.Errorf("auth: central cookie logout URL: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return fmt.Errorf("auth: central cookie logout request: %w", err)
	}
	req.AddCookie(&http.Cookie{Name: CentralSessionCookieName, Value: cookieValue})

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("auth: central cookie logout request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return ErrInvalidToken
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("auth: central cookie logout status %d", resp.StatusCode)
	}
	return nil
}

func (c *CentralClient) backendURL() string {
	if c.internalURL != "" {
		return c.internalURL
	}
	return c.baseURL
}
