package email

import (
	"context"
	"log/slog"
)

type LogMailer struct{}

func NewLog() *LogMailer {
	return &LogMailer{}
}

func (m *LogMailer) Send(_ context.Context, msg Message) error {
	slog.Info("email (log provider)",
		"to", msg.To,
		"subject", msg.Subject,
		"body", msg.Body,
	)
	return nil
}
