package auth

import (
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

type CentralClient struct {
	baseURL string
	client  *http.Client
}

func NewCentralClient(baseURL string, client *http.Client) *CentralClient {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return &CentralClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  client,
	}
}

func (c *CentralClient) ValidateSession(ctx context.Context, token string) (CentralSession, error) {
	if token == "" {
		return CentralSession{}, ErrInvalidToken
	}
	endpoint, err := url.JoinPath(c.baseURL, "/api/auth/session")
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

func (c *CentralClient) Logout(ctx context.Context, token string) error {
	if token == "" {
		return ErrInvalidToken
	}
	endpoint, err := url.JoinPath(c.baseURL, "/api/auth/session")
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
