package mail

import (
	"context"
	"fmt"
	"net/smtp"
	"strconv"
	"strings"
)

type SMTPMailer struct {
	host     string
	port     int
	username string
	password string
	from     string
}

func NewSMTPMailer(host, port, username, password, from string) (*SMTPMailer, error) {
	host = strings.TrimSpace(host)
	from = strings.TrimSpace(from)
	if host == "" || from == "" {
		return nil, fmt.Errorf("smtp mailer requires host and from address")
	}
	parsedPort, err := strconv.Atoi(strings.TrimSpace(port))
	if err != nil || parsedPort <= 0 {
		parsedPort = 587
	}
	return &SMTPMailer{
		host:     host,
		port:     parsedPort,
		username: strings.TrimSpace(username),
		password: password,
		from:     from,
	}, nil
}

func (m *SMTPMailer) SendMagicLink(_ context.Context, toEmail, magicLinkURL string) error {
	toEmail = strings.ToLower(strings.TrimSpace(toEmail))
	if toEmail == "" {
		return fmt.Errorf("smtp mailer: recipient required")
	}
	addr := fmt.Sprintf("%s:%d", m.host, m.port)
	subject := "Sign in to Project PN"
	body := fmt.Sprintf("Click the link below to sign in to Project PN. This link expires in 15 minutes.\r\n\r\n%s\r\n", magicLinkURL)
	msg := strings.Join([]string{
		fmt.Sprintf("From: %s", m.from),
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	var auth smtp.Auth
	if m.username != "" {
		auth = smtp.PlainAuth("", m.username, m.password, m.host)
	}
	return smtp.SendMail(addr, auth, m.from, []string{toEmail}, []byte(msg))
}
