package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"project-pn/internal/words"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

// ExpoSender delivers push notifications through the Expo push API.
type ExpoSender struct {
	HTTPClient  *http.Client
	AccessToken string
}

type expoMessage struct {
	To    string `json:"to"`
	Title string `json:"title"`
	Body  string `json:"body"`
	Sound string `json:"sound,omitempty"`
}

// Send dispatches a push notification to the given Expo tokens.
func (s *ExpoSender) Send(ctx context.Context, tokens []string, title, body string) error {
	if len(tokens) == 0 {
		return nil
	}
	if s.HTTPClient == nil {
		s.HTTPClient = http.DefaultClient
	}

	messages := make([]expoMessage, 0, len(tokens))
	for _, token := range tokens {
		messages = append(messages, expoMessage{
			To:    token,
			Title: title,
			Body:  body,
			Sound: "default",
		})
	}

	payload, err := json.Marshal(messages)
	if err != nil {
		return fmt.Errorf("notify: marshal expo payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("notify: create expo request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if s.AccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.AccessToken)
	}

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("notify: expo push request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("notify: expo push failed (%d): %s", resp.StatusCode, string(bodyBytes))
	}
	return nil
}

// Worker periodically evaluates and sends re-engagement notifications.
type Worker struct {
	Words    *words.Service
	Sender   *ExpoSender
	Interval time.Duration
}

// Run executes notification ticks until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) {
	if w.Words == nil || w.Sender == nil {
		return
	}
	interval := w.Interval
	if interval <= 0 {
		interval = 15 * time.Minute
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	w.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.tick(ctx)
		}
	}
}

func (w *Worker) tick(ctx context.Context) {
	now := time.Now().UTC()
	candidates, err := w.Words.BuildNotificationCandidates(ctx, now)
	if err != nil {
		slog.Error("notification worker: build candidates failed", "error", err)
		return
	}

	for _, candidate := range candidates {
		if err := w.Sender.Send(ctx, candidate.Tokens, candidate.Title, candidate.Body); err != nil {
			slog.Error("notification worker: send failed",
				"user_id", candidate.UserID,
				"type", candidate.NotificationType,
				"error", err,
			)
			continue
		}
		if err := w.Words.RecordNotificationSend(ctx, candidate.UserID, candidate.NotificationType, candidate.Title, candidate.Body); err != nil {
			slog.Error("notification worker: record send failed", "error", err)
		}
	}
}
