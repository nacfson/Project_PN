package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// PlatformUserEnsurer describes provisioning or resolving a local user from verified platform claims.
type PlatformUserEnsurer interface {
	EnsurePlatformUser(ctx context.Context, issuer, subject, email, signInMethod string) (AuthResult, error)
}

// EnsurePlatformUser provisions or resolves a local user strictly by (issuer, subject).
// Email is treated as an informational snapshot only; same-email auto-linking is NOT performed.
// Verified identities receive ordinary user privileges with no admin grant.
func (s *Service) EnsurePlatformUser(ctx context.Context, issuer, subject, email, signInMethod string) (AuthResult, error) {
	issuer = strings.TrimRight(strings.TrimSpace(issuer), "/")
	subject = strings.TrimSpace(subject)
	if issuer == "" || subject == "" {
		return AuthResult{}, errors.New("auth: issuer and subject are required")
	}

	method := strings.ToLower(strings.TrimSpace(signInMethod))
	if method == "" {
		method = "google"
	}
	if method != "google" && method != "apple" && method != "email" {
		method = "google"
	}

	normEmail := NormalizeEmail(email)

	nativeLang, err := s.resolveDefinitionLang("")
	if err != nil {
		return AuthResult{}, err
	}
	targetLang, err := s.resolveTargetLang("")
	if err != nil {
		return AuthResult{}, err
	}
	uiLang, err := s.resolveUILang("")
	if err != nil {
		return AuthResult{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return AuthResult{}, fmt.Errorf("auth: begin platform user sync: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string

	// 1. Primary lookup strictly by (issuer, subject)
	err = tx.QueryRow(ctx, `
		select user_id::text
		from user_identities
		where issuer = $1 and subject = $2
	`, issuer, subject).Scan(&userID)

	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return AuthResult{}, fmt.Errorf("auth: lookup platform identity: %w", err)
		}

		// 2. Identity does not exist: create a new local user with ordinary access only
		userEmail := normEmail
		if userEmail == "" {
			userEmail = fmt.Sprintf("%s@platform.project-pn.local", subject)
		}

		// If this exact email already exists in users table (e.g. from an existing unmigrated account),
		// avoid collision on unique email by appending subject fragment
		var emailConflict string
		err = tx.QueryRow(ctx, `select id::text from users where lower(email) = $1`, userEmail).Scan(&emailConflict)
		if err == nil {
			subSuffix := subject
			if len(subSuffix) > 8 {
				subSuffix = subSuffix[:8]
			}
			parts := strings.Split(userEmail, "@")
			userEmail = fmt.Sprintf("%s+%s@platform.project-pn.local", parts[0], subSuffix)
		}

		err = tx.QueryRow(ctx, `
			insert into users (email, email_verified_at, native_language, target_language, ui_language)
			values ($1, now(), $2, $3, $4)
			returning id::text
		`, userEmail, nativeLang, targetLang, uiLang).Scan(&userID)
		if err != nil {
			return AuthResult{}, fmt.Errorf("auth: insert user: %w", err)
		}

		_, err = tx.Exec(ctx, `
			insert into user_identities (user_id, issuer, subject, sign_in_method, email_at_provider, provider, provider_subject)
			values ($1::uuid, $2, $3, $4, $5, $4, $3)
		`, userID, issuer, subject, method, normEmail)
		if err != nil {
			return AuthResult{}, fmt.Errorf("auth: insert platform identity: %w", err)
		}
	} else {
		// Existing user found: update email_at_provider snapshot if available
		if normEmail != "" {
			_, _ = tx.Exec(ctx, `
				update user_identities
				set email_at_provider = $1
				where issuer = $2 and subject = $3
			`, normEmail, issuer, subject)
		}
	}

	_, err = tx.Exec(ctx, `
		insert into user_languages (user_id, target_language, display_language, is_active)
		select $1::uuid, $2, $3, true
		where not exists (
			select 1 from user_languages where user_id = $1::uuid
		)
		on conflict (user_id, target_language) do nothing
	`, userID, targetLang, nativeLang)
	if err != nil {
		return AuthResult{}, fmt.Errorf("auth: ensure user language: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return AuthResult{}, fmt.Errorf("auth: commit user sync: %w", err)
	}

	user, err := s.userByID(ctx, userID)
	if err != nil {
		return AuthResult{}, fmt.Errorf("auth: load user: %w", err)
	}

	return AuthResult{
		User:            user,
		SessionProvider: method,
		// Ordinary learner access only: no admin grant
	}, nil
}
