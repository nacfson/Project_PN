package mail

import "context"

type Mailer interface {
	SendMagicLink(ctx context.Context, toEmail, magicLinkURL string) error
}
