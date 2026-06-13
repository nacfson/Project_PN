package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type ResendMailer struct {
	apiKey string
	from   string
	client *http.Client
}

func NewResend(apiKey, from string) *ResendMailer {
	return &ResendMailer{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (m *ResendMailer) Send(ctx context.Context, msg Message) error {
	payload := map[string]any{
		"from":    m.from,
		"to":      []string{msg.To},
		"subject": msg.Subject,
		"text":    msg.Body,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("email: marshal resend payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("email: build resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("email: resend request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("email: resend status %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func NewProvider(name, apiKey, from string) Mailer {
	switch name {
	case "resend":
		return NewResend(apiKey, from)
	default:
		return NewLog()
	}
}
