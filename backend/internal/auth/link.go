package auth

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	linkRequestTTL      = 15 * time.Minute
	linkResendCooldown   = 60 * time.Second
	linkApprovalMethod  = "central_magic_link"
)

func (s *Service) CreateLinkRequest(ctx context.Context, userID string, pending PendingIdentity) (LinkRequest, error) {
	if pending.Provider == "" || pending.ProviderSubject == "" {
		return LinkRequest{}, ErrNoPendingIdentity
	}
	email := NormalizeEmail(pending.Email)
	if email == "" {
		return LinkRequest{}, ErrNoPendingIdentity
	}

	// Idempotent: return existing pending for same provider; resend if cooldown allows.
	if existing, err := s.GetPendingLinkRequest(ctx, userID); err == nil && existing.PendingProvider == pending.Provider {
		req, err := s.ResendLinkRequest(ctx, userID, existing.ID)
		if errors.Is(err, ErrLinkResendCooldown) {
			return existing, nil
		}
		return req, err
	}

	expiresAt := time.Now().Add(linkRequestTTL)
	var req LinkRequest
	err := s.pool.QueryRow(ctx, `
		insert into account_link_requests (
			user_id, initiated_by_user_id,
			pending_provider, pending_provider_subject, pending_email,
			expires_at, magic_link_sent_at
		) values ($1::uuid, $1::uuid, $2, $3, $4, $5, now())
		returning id::text, status, pending_provider, pending_email, expires_at
	`, userID, pending.Provider, pending.ProviderSubject, email, expiresAt).Scan(
		&req.ID, &req.Status, &req.PendingProvider, &req.Email, &req.ExpiresAt,
	)
	if err != nil {
		return LinkRequest{}, fmt.Errorf("auth: create link request: %w", err)
	}
	if err := s.sendLinkMagicLink(ctx, req); err != nil {
		return LinkRequest{}, err
	}
	return req, nil
}

func (s *Service) GetPendingLinkRequest(ctx context.Context, userID string) (LinkRequest, error) {
	var req LinkRequest
	err := s.pool.QueryRow(ctx, `
		select id::text, status, pending_provider, pending_email, expires_at
		from account_link_requests
		where user_id = $1::uuid
		  and status = 'pending'
		  and expires_at > now()
		order by created_at desc
		limit 1
	`, userID).Scan(&req.ID, &req.Status, &req.PendingProvider, &req.Email, &req.ExpiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return LinkRequest{}, ErrLinkRequestNotFound
		}
		return LinkRequest{}, fmt.Errorf("auth: get pending link request: %w", err)
	}
	return req, nil
}

func (s *Service) ResendLinkRequest(ctx context.Context, userID, requestID string) (LinkRequest, error) {
	var (
		req            LinkRequest
		magicLinkSent  *time.Time
		pendingSubject string
	)
	err := s.pool.QueryRow(ctx, `
		select id::text, status, pending_provider, pending_provider_subject, pending_email, expires_at, magic_link_sent_at
		from account_link_requests
		where id = $1::uuid
		  and user_id = $2::uuid
		  and initiated_by_user_id = $2::uuid
		  and status = 'pending'
	`, requestID, userID).Scan(
		&req.ID, &req.Status, &req.PendingProvider, &pendingSubject, &req.Email, &req.ExpiresAt, &magicLinkSent,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return LinkRequest{}, ErrLinkRequestNotFound
		}
		return LinkRequest{}, fmt.Errorf("auth: load link request for resend: %w", err)
	}
	if req.ExpiresAt.Before(time.Now()) {
		_ = s.markLinkExpired(ctx, req.ID)
		return LinkRequest{}, ErrLinkRequestExpired
	}
	if magicLinkSent != nil && time.Since(*magicLinkSent) < linkResendCooldown {
		return LinkRequest{}, ErrLinkResendCooldown
	}

	expiresAt := time.Now().Add(linkRequestTTL)
	err = s.pool.QueryRow(ctx, `
		update account_link_requests
		set expires_at = $2, magic_link_sent_at = now()
		where id = $1::uuid
		returning id::text, status, pending_provider, pending_email, expires_at
	`, req.ID, expiresAt).Scan(&req.ID, &req.Status, &req.PendingProvider, &req.Email, &req.ExpiresAt)
	if err != nil {
		return LinkRequest{}, fmt.Errorf("auth: update link request resend: %w", err)
	}
	if err := s.sendLinkMagicLink(ctx, req); err != nil {
		return LinkRequest{}, err
	}
	return req, nil
}

func (s *Service) CancelLinkRequest(ctx context.Context, userID, sessionProvider, requestID string) error {
	tag, err := s.pool.Exec(ctx, `
		update account_link_requests
		set status = 'cancelled', cancelled_at = now()
		where id = $1::uuid
		  and status = 'pending'
		  and (
		    initiated_by_user_id = $2::uuid
		    or (user_id = $2::uuid and $3 = $4)
		  )
	`, requestID, userID, sessionProvider, ProviderNacfson)
	if err != nil {
		return fmt.Errorf("auth: cancel link request: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrLinkRequestNotFound
	}
	return nil
}

func (s *Service) ConfirmLinkRequest(ctx context.Context, userID, sessionProvider, sessionEmail, requestID string) error {
	if sessionProvider != ProviderNacfson {
		return ErrLinkConfirmForbidden
	}
	sessionEmail = NormalizeEmail(sessionEmail)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("auth: begin link confirm: %w", err)
	}
	defer tx.Rollback(ctx)

	var (
		pendingProvider string
		pendingSubject  string
		pendingEmail    string
		expiresAt       time.Time
	)
	err = tx.QueryRow(ctx, `
		select pending_provider, pending_provider_subject, pending_email, expires_at
		from account_link_requests
		where id = $1::uuid
		  and user_id = $2::uuid
		  and status = 'pending'
		for update
	`, requestID, userID).Scan(&pendingProvider, &pendingSubject, &pendingEmail, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrLinkRequestNotFound
		}
		return fmt.Errorf("auth: load link request: %w", err)
	}
	if expiresAt.Before(time.Now()) {
		_, _ = tx.Exec(ctx, `
			update account_link_requests set status = 'expired' where id = $1::uuid
		`, requestID)
		_ = tx.Commit(ctx)
		return ErrLinkRequestExpired
	}
	if NormalizeEmail(pendingEmail) != sessionEmail {
		return ErrLinkConfirmForbidden
	}
	if pendingProvider == sessionProvider {
		return ErrLinkConfirmForbidden
	}

	var otherUser string
	err = tx.QueryRow(ctx, `
		select user_id::text
		from user_identities
		where provider = $1 and provider_subject = $2
	`, pendingProvider, pendingSubject).Scan(&otherUser)
	if err == nil && otherUser != userID {
		return ErrLinkIdentityConflict
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("auth: check identity conflict: %w", err)
	}

	if err := linkProviderTx(ctx, tx, userID, PendingIdentity{
		Provider:        pendingProvider,
		ProviderSubject: pendingSubject,
		Email:           pendingEmail,
	}); err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		update account_link_requests
		set status = 'completed',
		    approval_method = $2,
		    completed_at = now()
		where id = $1::uuid
	`, requestID, linkApprovalMethod)
	if err != nil {
		return fmt.Errorf("auth: complete link request: %w", err)
	}
	return tx.Commit(ctx)
}

func linkProviderTx(ctx context.Context, tx pgx.Tx, userID string, pending PendingIdentity) error {
	if pending.Provider == "" || pending.ProviderSubject == "" {
		return ErrInvalidToken
	}
	email := NormalizeEmail(pending.Email)
	_, err := tx.Exec(ctx, `
		insert into user_identities (user_id, provider, provider_subject, email_at_provider)
		values ($1::uuid, $2, $3, $4)
		on conflict (provider, provider_subject) do update
		set user_id = excluded.user_id,
		    email_at_provider = excluded.email_at_provider,
		    linked_at = now()
	`, userID, pending.Provider, pending.ProviderSubject, email)
	if err != nil {
		return fmt.Errorf("auth: link provider: %w", err)
	}
	return nil
}

func (s *Service) sendLinkMagicLink(ctx context.Context, req LinkRequest) error {
	if s.magicLinks == nil {
		return fmt.Errorf("auth: magic link sender is not configured")
	}
	if s.publicAppURL == "" {
		return fmt.Errorf("auth: PUBLIC_APP_URL is not configured")
	}
	redirect := s.publicAppURL + "/link-approve?requestId=" + url.QueryEscape(req.ID)
	if err := s.magicLinks.SendMagicLink(ctx, req.Email, redirect); err != nil {
		return fmt.Errorf("auth: send link magic link: %w", err)
	}
	return nil
}

func (s *Service) markLinkExpired(ctx context.Context, requestID string) error {
	_, err := s.pool.Exec(ctx, `
		update account_link_requests
		set status = 'expired'
		where id = $1::uuid and status = 'pending'
	`, requestID)
	return err
}

// LinkApproveRedirectURL builds the public app approve path for tests/docs.
func (s *Service) LinkApproveRedirectURL(requestID string) string {
	if s.publicAppURL == "" {
		return ""
	}
	return s.publicAppURL + "/link-approve?requestId=" + url.QueryEscape(requestID)
}
