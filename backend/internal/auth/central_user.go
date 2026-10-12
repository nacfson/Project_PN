package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// EnsureCentralUser provisions or resolves a local user from a central auth session.
func (s *Service) EnsureCentralUser(ctx context.Context, session CentralSession) (AuthResult, error) {
	emailAddr := NormalizeEmail(session.User.Email)
	if session.User.ID == "" || emailAddr == "" {
		return AuthResult{}, ErrInvalidToken
	}

	authProvider := session.AuthProvider
	providerSubject := session.Identity.ProviderSubject
	if authProvider == "" {
		authProvider = ProviderGoogle
	}
	if providerSubject == "" {
		providerSubject = session.User.ID
	}

	pnProvider, pnSubject := MapCentralProvider(authProvider, providerSubject, session.User.ID)

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
		return AuthResult{}, fmt.Errorf("auth: begin user sync: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string

	err = tx.QueryRow(ctx, `
		select user_id::text
		from user_identities
		where provider = $1 and provider_subject = $2
	`, pnProvider, pnSubject).Scan(&userID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return AuthResult{}, fmt.Errorf("auth: lookup identity: %w", err)
		}

		var existingUserID string
		err = tx.QueryRow(ctx, `
			select id::text
			from users
			where lower(email) = $1
		`, emailAddr).Scan(&existingUserID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return AuthResult{}, fmt.Errorf("auth: lookup user email: %w", err)
		}

		method := "google"
		if pnProvider == "apple" || pnProvider == "email" {
			method = pnProvider
		}
		const defaultIssuer = "https://auth.nacfson.cloud/realms/platform"

		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `
				insert into users (email, email_verified_at, native_language, target_language, ui_language)
				values ($1, now(), $2, $3, $4)
				returning id::text
			`, emailAddr, nativeLang, targetLang, uiLang).Scan(&userID)
			if err != nil {
				return AuthResult{}, fmt.Errorf("auth: insert user: %w", err)
			}
			_, err = tx.Exec(ctx, `
				insert into user_identities (user_id, issuer, subject, sign_in_method, provider, provider_subject, email_at_provider)
				values ($1::uuid, $2, $3, $4, $5, $6, $7)
			`, userID, defaultIssuer, pnSubject, method, pnProvider, pnSubject, emailAddr)
			if err != nil {
				return AuthResult{}, fmt.Errorf("auth: insert identity: %w", err)
			}
		} else {
			userID = existingUserID
			_, err = tx.Exec(ctx, `
				insert into user_identities (user_id, issuer, subject, sign_in_method, provider, provider_subject, email_at_provider)
				values ($1::uuid, $2, $3, $4, $5, $6, $7)
				on conflict (issuer, subject) do update
				set user_id = excluded.user_id,
				    email_at_provider = excluded.email_at_provider,
				    linked_at = now()
			`, userID, defaultIssuer, pnSubject, method, pnProvider, pnSubject, emailAddr)
			if err != nil {
				return AuthResult{}, fmt.Errorf("auth: link identity: %w", err)
			}
		}
	}

	_, err = tx.Exec(ctx, `
		update users
		set email_verified_at = coalesce(email_verified_at, now()),
		    ui_language = coalesce(nullif(ui_language, ''), $2),
		    updated_at = now()
		where id = $1::uuid
	`, userID, uiLang)
	if err != nil {
		return AuthResult{}, fmt.Errorf("auth: update user: %w", err)
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
		return AuthResult{}, err
	}
	return AuthResult{
		User:            user,
		SessionProvider: pnProvider,
	}, nil
}

func (s *Service) ListLinkedProviders(ctx context.Context, userID string) ([]LinkedProvider, error) {
	rows, err := s.pool.Query(ctx, `
		select coalesce(provider, 'google'),
		       coalesce(issuer, ''),
		       coalesce(subject, provider_subject, ''),
		       coalesce(sign_in_method, 'google'),
		       coalesce(email_at_provider, ''),
		       coalesce(linked_at, created_at, now())
		from user_identities
		where user_id = $1::uuid
		order by created_at asc
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("auth: list linked providers: %w", err)
	}
	defer rows.Close()

	var providers []LinkedProvider
	for rows.Next() {
		var item LinkedProvider
		if err := rows.Scan(&item.Provider, &item.Issuer, &item.Subject, &item.SignInMethod, &item.Email, &item.LinkedAt); err != nil {
			return nil, err
		}
		providers = append(providers, item)
	}
	return providers, rows.Err()
}

func EmailDomain(email string) string {
	email = NormalizeEmail(email)
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return ""
	}
	return strings.ToLower(parts[1])
}

func (s *Service) MergeSuggestions(ctx context.Context, userID, email string) ([]MergeSuggestion, error) {
	domain := EmailDomain(email)
	if domain == "" {
		return nil, nil
	}
	rows, err := s.pool.Query(ctx, `
		select distinct u.id::text, u.email
		from users u
		where u.id <> $1::uuid
		  and split_part(lower(u.email), '@', 2) = $2
		order by u.email
		limit 5
	`, userID, domain)
	if err != nil {
		return nil, fmt.Errorf("auth: merge suggestions: %w", err)
	}
	defer rows.Close()

	var suggestions []MergeSuggestion
	for rows.Next() {
		var item MergeSuggestion
		if err := rows.Scan(&item.SourceUserID, &item.SourceEmail); err != nil {
			return nil, err
		}
		item.Domain = domain
		suggestions = append(suggestions, item)
	}
	return suggestions, rows.Err()
}

func (s *Service) userByID(ctx context.Context, userID string) (User, error) {
	var user User
	var verifiedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		select id::text, email, email_verified_at, native_language, target_language, ui_language
		from users
		where id = $1::uuid
	`, userID).Scan(&user.ID, &user.Email, &verifiedAt, &user.NativeLanguage, &user.TargetLanguage, &user.UILanguage)
	if err != nil {
		return User{}, fmt.Errorf("auth: load user: %w", err)
	}
	user.EmailVerifiedAt = verifiedAt
	user.ActiveLanguage, _ = s.activeUserLanguage(ctx, user.ID)
	if user.ActiveLanguage.TargetLanguage == "" {
		user.ActiveLanguage = UserLanguage{
			UserID:          user.ID,
			TargetLanguage:  user.TargetLanguage,
			DisplayLanguage: user.NativeLanguage,
			IsActive:        true,
		}
	}
	return user, nil
}


// EnsurePlatformIdentity resolves or creates a local user for a confirmed platform identity (issuer, subject).
// A signed-in user is only (issuer, subject) for this project's audience. That pair does not grant
// business permissions. Email is not the identifier.
func (s *Service) EnsurePlatformIdentity(ctx context.Context, identity ConfirmedIdentity) (User, error) {
	if s.pool == nil {
		now := time.Now()
		return User{
			ID:              identity.Subject,
			Email:           fmt.Sprintf("%s@%s", identity.Subject, identity.Audience),
			EmailVerifiedAt: &now,
			NativeLanguage:  s.defaultDefinitionLang,
			TargetLanguage:  s.defaultTargetLang,
			UILanguage:      s.defaultUILang,
		}, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("auth: begin platform user sync: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `
		select user_id::text
		from user_identities
		where provider = $1 and provider_subject = $2
	`, identity.Issuer, identity.Subject).Scan(&userID)

	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return User{}, fmt.Errorf("auth: lookup platform identity: %w", err)
		}

		targetLang, _ := s.resolveTargetLang("")
		nativeLang, _ := s.resolveDefinitionLang("")
		uiLang, _ := s.resolveUILang("")

		placeholderEmail := fmt.Sprintf("%s@%s", identity.Subject, identity.Audience)

		err = tx.QueryRow(ctx, `
			insert into users (email, email_verified_at, native_language, target_language, ui_language)
			values ($1, now(), $2, $3, $4)
			returning id::text
		`, placeholderEmail, nativeLang, targetLang, uiLang).Scan(&userID)
		if err != nil {
			return User{}, fmt.Errorf("auth: insert platform user: %w", err)
		}

		_, err = tx.Exec(ctx, `
			insert into user_identities (user_id, provider, provider_subject, email_at_provider)
			values ($1::uuid, $2, $3, $4)
		`, userID, identity.Issuer, identity.Subject, placeholderEmail)
		if err != nil {
			return User{}, fmt.Errorf("auth: insert platform identity: %w", err)
		}

		_, err = tx.Exec(ctx, `
			insert into user_languages (user_id, target_language, display_language, is_active)
			values ($1::uuid, $2, $3, true)
			on conflict (user_id, target_language) do nothing
		`, userID, targetLang, nativeLang)
		if err != nil {
			return User{}, fmt.Errorf("auth: ensure user language: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("auth: commit platform user sync: %w", err)
	}

	return s.userByID(ctx, userID)
}
