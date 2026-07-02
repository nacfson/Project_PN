package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

const centralIdentityProvider = "nacfson"

func (s *Service) EnsureCentralUser(ctx context.Context, central CentralUser) (User, error) {
	emailAddr := NormalizeEmail(central.Email)
	if central.ID == "" || emailAddr == "" {
		return User{}, ErrInvalidToken
	}

	nativeLang, err := s.resolveDefinitionLang("")
	if err != nil {
		return User{}, err
	}
	targetLang, err := s.resolveTargetLang("")
	if err != nil {
		return User{}, err
	}
	uiLang, err := s.resolveUILang("")
	if err != nil {
		return User{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return User{}, fmt.Errorf("auth: begin central user sync: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `
		select user_id::text
		from user_identities
		where provider = $1 and provider_subject = $2
	`, centralIdentityProvider, central.ID).Scan(&userID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return User{}, fmt.Errorf("auth: lookup central identity: %w", err)
		}

		err = tx.QueryRow(ctx, `
			select id::text
			from users
			where lower(email) = $1
		`, emailAddr).Scan(&userID)
		if err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				return User{}, fmt.Errorf("auth: lookup central user email: %w", err)
			}
			err = tx.QueryRow(ctx, `
				insert into users (email, email_verified_at, native_language, target_language, ui_language)
				values ($1, now(), $2, $3, $4)
				returning id::text
			`, emailAddr, nativeLang, targetLang, uiLang).Scan(&userID)
			if err != nil {
				return User{}, fmt.Errorf("auth: insert central user: %w", err)
			}
		}

		_, err = tx.Exec(ctx, `
			insert into user_identities (user_id, provider, provider_subject, email_at_provider)
			values ($1::uuid, $2, $3, $4)
			on conflict (provider, provider_subject) do update
			set email_at_provider = excluded.email_at_provider
		`, userID, centralIdentityProvider, central.ID, emailAddr)
		if err != nil {
			return User{}, fmt.Errorf("auth: upsert central identity: %w", err)
		}
	}

	_, err = tx.Exec(ctx, `
		update users
		set email = $2,
		    email_verified_at = coalesce(email_verified_at, now()),
		    ui_language = coalesce(nullif(ui_language, ''), $3),
		    updated_at = now()
		where id = $1::uuid
	`, userID, emailAddr, uiLang)
	if err != nil {
		return User{}, fmt.Errorf("auth: update central user: %w", err)
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
		return User{}, fmt.Errorf("auth: ensure central user language: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, fmt.Errorf("auth: commit central user sync: %w", err)
	}

	return s.userByID(ctx, userID)
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
