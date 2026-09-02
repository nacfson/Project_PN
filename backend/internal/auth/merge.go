package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

const mergeRequestTTL = 24 * time.Hour

func (s *Service) CreateMergeRequest(ctx context.Context, targetUserID, sourceUserID, initiatedByUserID string) (string, error) {
	if targetUserID == sourceUserID {
		return "", fmt.Errorf("auth: cannot merge user into itself")
	}
	var sourceEmail, targetEmail string
	err := s.pool.QueryRow(ctx, `
		select
			(select email from users where id = $1::uuid),
			(select email from users where id = $2::uuid)
	`, sourceUserID, targetUserID).Scan(&sourceEmail, &targetEmail)
	if err != nil {
		return "", fmt.Errorf("auth: load merge emails: %w", err)
	}

	var requestID string
	err = s.pool.QueryRow(ctx, `
		insert into account_merge_requests (
			source_user_id, target_user_id, initiated_by_user_id,
			source_email, target_email, expires_at
		) values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
		returning id::text
	`, sourceUserID, targetUserID, initiatedByUserID, sourceEmail, targetEmail, time.Now().Add(mergeRequestTTL)).Scan(&requestID)
	if err != nil {
		return "", fmt.Errorf("auth: create merge request: %w", err)
	}
	return requestID, nil
}

func (s *Service) ConfirmMergeRequest(ctx context.Context, targetUserID, requestID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("auth: begin merge: %w", err)
	}
	defer tx.Rollback(ctx)

	var sourceUserID string
	err = tx.QueryRow(ctx, `
		select source_user_id::text
		from account_merge_requests
		where id = $1::uuid
		  and target_user_id = $2::uuid
		  and status = 'pending'
		  and expires_at > now()
	`, requestID, targetUserID).Scan(&sourceUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return fmt.Errorf("auth: load merge request: %w", err)
	}

	if err := mergeUsersTx(ctx, tx, targetUserID, sourceUserID); err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		update account_merge_requests
		set status = 'completed', completed_at = now()
		where id = $1::uuid
	`, requestID)
	if err != nil {
		return fmt.Errorf("auth: complete merge request: %w", err)
	}

	return tx.Commit(ctx)
}

func mergeUsersTx(ctx context.Context, tx pgx.Tx, targetUserID, sourceUserID string) error {
	// Remove duplicate word senses (keep target rows).
	_, err := tx.Exec(ctx, `
		delete from user_word_senses src
		using user_word_senses tgt
		where src.user_id = $1::uuid
		  and tgt.user_id = $2::uuid
		  and src.word_sense_id = tgt.word_sense_id
	`, sourceUserID, targetUserID)
	if err != nil {
		return fmt.Errorf("auth: dedupe word senses: %w", err)
	}

	_, err = tx.Exec(ctx, `
		delete from user_languages src
		using user_languages tgt
		where src.user_id = $1::uuid
		  and tgt.user_id = $2::uuid
		  and src.target_language = tgt.target_language
	`, sourceUserID, targetUserID)
	if err != nil {
		return fmt.Errorf("auth: dedupe languages: %w", err)
	}

	_, err = tx.Exec(ctx, `
		delete from review_settings
		where user_id = $1::uuid
		  and exists (select 1 from review_settings where user_id = $2::uuid)
	`, sourceUserID, targetUserID)
	if err != nil {
		return fmt.Errorf("auth: dedupe review settings: %w", err)
	}

	reassignQueries := []struct {
		query string
		args  []any
	}{
		{`update user_word_senses set user_id = $2::uuid where user_id = $1::uuid`, []any{sourceUserID, targetUserID}},
		{`update decks set user_id = $2::uuid where user_id = $1::uuid`, []any{sourceUserID, targetUserID}},
		{`update user_languages set user_id = $2::uuid where user_id = $1::uuid`, []any{sourceUserID, targetUserID}},
		{`update daily_review_counts set user_id = $2::uuid where user_id = $1::uuid`, []any{sourceUserID, targetUserID}},
		{`update user_streaks set user_id = $2::uuid where user_id = $1::uuid`, []any{sourceUserID, targetUserID}},
		{`update review_settings set user_id = $2::uuid where user_id = $1::uuid`, []any{sourceUserID, targetUserID}},
	}
	for _, q := range reassignQueries {
		if _, err := tx.Exec(ctx, q.query, q.args...); err != nil {
			return fmt.Errorf("auth: reassign data: %w", err)
		}
	}

	// Move identities that target does not already have.
	_, err = tx.Exec(ctx, `
		update user_identities ui
		set user_id = $2::uuid
		where ui.user_id = $1::uuid
		  and not exists (
			select 1 from user_identities existing
			where existing.user_id = $2::uuid
			  and existing.provider = ui.provider
		  )
	`, sourceUserID, targetUserID)
	if err != nil {
		return fmt.Errorf("auth: move identities: %w", err)
	}
	_, err = tx.Exec(ctx, `delete from user_identities where user_id = $1::uuid`, sourceUserID)
	if err != nil {
		return fmt.Errorf("auth: cleanup source identities: %w", err)
	}

	_, err = tx.Exec(ctx, `delete from users where id = $1::uuid`, sourceUserID)
	if err != nil {
		return fmt.Errorf("auth: delete source user: %w", err)
	}
	return nil
}
