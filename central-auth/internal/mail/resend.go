package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type ResendMailer struct {
	apiKey    string
	fromEmail string
	client    *http.Client
}

func NewResendMailer(apiKey, fromEmail string) *ResendMailer {
	return &ResendMailer{
		apiKey:    strings.TrimSpace(apiKey),
		fromEmail: strings.TrimSpace(fromEmail),
		client:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (m *ResendMailer) SendMagicLink(ctx context.Context, toEmail, magicLinkURL string) error {
	if m.apiKey == "" || m.fromEmail == "" {
		return fmt.Errorf("resend mailer is not configured")
	}
	body, err := json.Marshal(map[string]any{
		"from":    m.fromEmail,
		"to":      []string{strings.ToLower(strings.TrimSpace(toEmail))},
		"subject": "Sign in to Project PN",
		"html": fmt.Sprintf(
			`<p>Click the link below to sign in to Project PN. This link expires in 15 minutes.</p><p><a href="%s">Sign in</a></p>`,
			magicLinkURL,
		),
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := m.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("resend status %d", resp.StatusCode)
	}
	return nil
}
