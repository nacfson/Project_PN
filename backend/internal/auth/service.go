package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"project-pn/internal/email"
)

type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type Service struct {
	pool                   *pgxpool.Pool
	mailer                 email.Mailer
	sessionTTL             time.Duration
	emailVerificationTTL   time.Duration
	defaultDefinitionLang  string
	defaultTargetLang      string
	defaultUILang          string
	allowedDefinitionLangs []string
	allowedTargetLangs     []string
	allowedUILangs         []string
	forceDefinitionLang    string
	forceTargetLang        string
	forceUILang            string
	appPublicURL           string
	webAppPublicURL        string
}

type Options struct {
	SessionTTL             time.Duration
	EmailVerificationTTL   time.Duration
	DefaultDefinitionLang  string
	DefaultTargetLang      string
	DefaultUILang          string
	AllowedDefinitionLangs []string
	AllowedTargetLangs     []string
	AllowedUILangs         []string
	ForceDefinitionLang    string
	ForceTargetLang        string
	ForceUILang            string
	AppPublicURL           string
	WebAppPublicURL        string
}

func New(pool *pgxpool.Pool, mailer email.Mailer, opts Options) *Service {
	webAppPublicURL := opts.WebAppPublicURL
	if webAppPublicURL == "" {
		webAppPublicURL = opts.AppPublicURL
	}
	return &Service{
		pool:                   pool,
		mailer:                 mailer,
		sessionTTL:             opts.SessionTTL,
		emailVerificationTTL:   opts.EmailVerificationTTL,
		defaultDefinitionLang:  opts.DefaultDefinitionLang,
		defaultTargetLang:      opts.DefaultTargetLang,
		defaultUILang:          opts.DefaultUILang,
		allowedDefinitionLangs: opts.AllowedDefinitionLangs,
		allowedTargetLangs:     opts.AllowedTargetLangs,
		allowedUILangs:         opts.AllowedUILangs,
		forceDefinitionLang:    opts.ForceDefinitionLang,
		forceTargetLang:        opts.ForceTargetLang,
		forceUILang:            opts.ForceUILang,
		appPublicURL:           opts.AppPublicURL,
		webAppPublicURL:        webAppPublicURL,
	}
}

func (s *Service) AppPublicURL() string {
	return s.appPublicURL
}

func (s *Service) WebAppPublicURL() string {
	return s.webAppPublicURL
}

func (s *Service) LanguageOptions() LanguageOptions {
	return LanguageOptions{
		Defaults: LanguagePair{
			TargetLanguage:     s.defaultTargetLang,
			DefinitionLanguage: s.defaultDefinitionLang,
		},
		Allowed: AllowedLanguages{
			TargetLanguages:     s.allowedTargetLangs,
			DefinitionLanguages: s.allowedDefinitionLangs,
			UILanguages:         s.allowedUILangs,
		},
		Forced: LanguagePair{
			TargetLanguage:     s.forceTargetLang,
			DefinitionLanguage: s.forceDefinitionLang,
		},
		UIDefaults: s.defaultUILang,
		UIForced:   s.forceUILang,
	}
}

func (s *Service) resolveTargetLang(requested string) (string, error) {
	if s.forceTargetLang != "" {
		return s.forceTargetLang, nil
	}
	if requested == "" {
		return s.defaultTargetLang, nil
	}
	if len(s.allowedTargetLangs) > 0 && !contains(s.allowedTargetLangs, requested) {
		return "", ErrInvalidTargetLang
	}
	return requested, nil
}

func (s *Service) resolveDefinitionLang(requested string) (string, error) {
	if s.forceDefinitionLang != "" {
		return s.forceDefinitionLang, nil
	}
	if requested == "" {
		return s.defaultDefinitionLang, nil
	}
	if len(s.allowedDefinitionLangs) > 0 && !contains(s.allowedDefinitionLangs, requested) {
		return "", ErrInvalidDefinitionLang
	}
	return requested, nil
}

func (s *Service) resolveUILang(requested string) (string, error) {
	if s.forceUILang != "" {
		return s.forceUILang, nil
	}
	if requested == "" {
		return s.defaultUILang, nil
	}
	if len(s.allowedUILangs) > 0 && !contains(s.allowedUILangs, requested) {
		return "", ErrInvalidUILang
	}
	return requested, nil
}

func (s *Service) Register(ctx context.Context, emailAddr, password, nativeLang, targetLang, uiLang string) error {
	emailAddr = NormalizeEmail(emailAddr)
	if emailAddr == "" {
		return ErrEmailRequired
	}
	if len(password) < 8 {
		return ErrWeakPassword
	}

	targetLang, err := s.resolveTargetLang(targetLang)
	if err != nil {
		return err
	}
	nativeLang, err = s.resolveDefinitionLang(nativeLang)
	if err != nil {
		return err
	}
	uiLang, err = s.resolveUILang(uiLang)
	if err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("auth: hash password: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `
		insert into users (email, password_hash, native_language, target_language, ui_language)
		values ($1, $2, $3, $4, $5)
		returning id
	`, emailAddr, string(hash), nativeLang, targetLang, uiLang).Scan(&userID)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrEmailTaken
		}
		return fmt.Errorf("auth: insert user: %w", err)
	}

	_, err = tx.Exec(ctx, `
		insert into user_languages (user_id, target_language, display_language, is_active)
		values ($1::uuid, $2, $3, true)
	`, userID, targetLang, nativeLang)
	if err != nil {
		return fmt.Errorf("auth: insert user language: %w", err)
	}

	if err := s.sendVerificationEmailTx(ctx, tx, userID, emailAddr); err != nil {
		return fmt.Errorf("auth: send verification email: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("auth: commit register: %w", err)
	}
	return nil
}

func (s *Service) Login(ctx context.Context, emailAddr, password string) (Session, error) {
	emailAddr = NormalizeEmail(emailAddr)
	if emailAddr == "" {
		return Session{}, ErrInvalidCredentials
	}

	var userID, passwordHash string
	var verifiedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		select id, password_hash, email_verified_at
		from users
		where lower(email) = $1
	`, emailAddr).Scan(&userID, &passwordHash, &verifiedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Session{}, ErrInvalidCredentials
		}
		return Session{}, fmt.Errorf("auth: lookup user: %w", err)
	}
	if passwordHash == "" {
		return Session{}, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return Session{}, ErrInvalidCredentials
	}
	if verifiedAt == nil {
		return Session{}, ErrEmailNotVerified
	}

	return s.IssueSession(ctx, userID)
}

func (s *Service) IssueSession(ctx context.Context, userID string) (Session, error) {
	plain, hash, err := newOpaqueToken()
	if err != nil {
		return Session{}, err
	}
	expiresAt := time.Now().Add(s.sessionTTL)

	_, err = s.pool.Exec(ctx, `
		insert into sessions (user_id, token_hash, expires_at)
		values ($1, $2, $3)
	`, userID, hash, expiresAt)
	if err != nil {
		return Session{}, fmt.Errorf("auth: insert session: %w", err)
	}

	return Session{Token: plain, ExpiresAt: expiresAt}, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (User, error) {
	if token == "" {
		return User{}, ErrInvalidToken
	}

	_, _ = s.pool.Exec(ctx, `delete from sessions where expires_at < now()`)

	hash := hashToken(token)
	var user User
	var verifiedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		select u.id, u.email, u.email_verified_at, u.native_language, u.target_language, u.ui_language
		from sessions s
		join users u on u.id = s.user_id
		where s.token_hash = $1 and s.expires_at > now()
	`, hash).Scan(&user.ID, &user.Email, &verifiedAt, &user.NativeLanguage, &user.TargetLanguage, &user.UILanguage)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrInvalidToken
		}
		return User{}, fmt.Errorf("auth: authenticate: %w", err)
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

func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return ErrInvalidToken
	}
	tag, err := s.pool.Exec(ctx, `
		delete from sessions where token_hash = $1
	`, hashToken(token))
	if err != nil {
		return fmt.Errorf("auth: logout: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrInvalidToken
	}
	return nil
}

func (s *Service) SendVerificationEmail(ctx context.Context, emailAddr string) error {
	emailAddr = NormalizeEmail(emailAddr)
	if emailAddr == "" {
		return nil
	}

	var userID string
	err := s.pool.QueryRow(ctx, `
		select id
		from users
		where lower(email) = $1 and email_verified_at is null
	`, emailAddr).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("auth: lookup user for verification email: %w", err)
	}

	return s.sendVerificationEmailTx(ctx, s.pool, userID, emailAddr)
}

// VerifyEmailForTest marks a user's email as verified directly, bypassing the token flow.
// It is exported for integration tests that need an already-verified test account.
func (s *Service) VerifyEmailForTest(ctx context.Context, emailAddr string) error {
	emailAddr = NormalizeEmail(emailAddr)
	_, err := s.pool.Exec(ctx, `
		update users set email_verified_at = now() where lower(email) = $1
	`, emailAddr)
	if err != nil {
		return fmt.Errorf("auth: verify email for test: %w", err)
	}
	return nil
}

// InsertVerificationTokenForTest seeds an email verification token for integration tests.
func (s *Service) InsertVerificationTokenForTest(ctx context.Context, emailAddr string) (string, error) {
	emailAddr = NormalizeEmail(emailAddr)
	var userID string
	if err := s.pool.QueryRow(ctx, `select id from users where lower(email) = $1`, emailAddr).Scan(&userID); err != nil {
		return "", fmt.Errorf("auth: lookup user for test token: %w", err)
	}

	plain, hash, err := newOpaqueToken()
	if err != nil {
		return "", err
	}
	_, err = s.pool.Exec(ctx, `
		insert into email_verification_tokens (user_id, token_hash, expires_at)
		values ($1, $2, now() + interval '1 hour')
	`, userID, hash)
	if err != nil {
		return "", fmt.Errorf("auth: insert test verification token: %w", err)
	}
	return plain, nil
}

func (s *Service) sendVerificationEmailTx(ctx context.Context, q querier, userID, emailAddr string) error {
	plain, hash, err := newOpaqueToken()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(s.emailVerificationTTL)

	_, err = q.Exec(ctx, `
		insert into email_verification_tokens (user_id, token_hash, expires_at)
		values ($1, $2, $3)
	`, userID, hash, expiresAt)
	if err != nil {
		return fmt.Errorf("auth: insert verification token: %w", err)
	}

	verifyURL := fmt.Sprintf("%s/api/auth/verify-email?token=%s", s.appPublicURL, plain)
	return s.mailer.Send(ctx, email.Message{
		To:      emailAddr,
		Subject: "Verify your Project PN email",
		Body:    fmt.Sprintf("Verify your email address for Project PN:\n\n%s\n\nThis link expires in %s.", verifyURL, s.emailVerificationTTL),
	})
}

func (s *Service) ConsumeVerificationToken(ctx context.Context, token string) (emailAddr string, err error) {
	if token == "" {
		return "", ErrVerificationTokenInvalid
	}

	_, _ = s.pool.Exec(ctx, `
		delete from email_verification_tokens
		where expires_at < now() or consumed_at is not null
	`)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	hash := hashToken(token)
	var userID string
	var tokenID string
	err = tx.QueryRow(ctx, `
		select id, user_id
		from email_verification_tokens
		where token_hash = $1
		  and expires_at > now()
		  and consumed_at is null
		for update
	`, hash).Scan(&tokenID, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrVerificationTokenInvalid
		}
		return "", fmt.Errorf("auth: consume verification lookup: %w", err)
	}

	now := time.Now()
	if _, err := tx.Exec(ctx, `
		update email_verification_tokens set consumed_at = $2 where id = $1
	`, tokenID, now); err != nil {
		return "", fmt.Errorf("auth: mark verification token consumed: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		update users
		set email_verified_at = coalesce(email_verified_at, $2), updated_at = $2
		where id = $1
	`, userID, now); err != nil {
		return "", fmt.Errorf("auth: verify email: %w", err)
	}

	err = tx.QueryRow(ctx, `select email from users where id = $1`, userID).Scan(&emailAddr)
	if err != nil {
		return "", fmt.Errorf("auth: read verified email: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("auth: commit verification: %w", err)
	}
	return emailAddr, nil
}

// GetUserLanguages returns every learning pair for a user, ordered by creation.
func (s *Service) GetUserLanguages(ctx context.Context, userID string) ([]UserLanguage, error) {
	rows, err := s.pool.Query(ctx, `
		select user_id::text, target_language, display_language, is_active, created_at, updated_at
		from user_languages
		where user_id = $1::uuid
		order by created_at, target_language
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("auth: list user languages: %w", err)
	}
	defer rows.Close()

	var out []UserLanguage
	for rows.Next() {
		var ul UserLanguage
		if err := rows.Scan(&ul.UserID, &ul.TargetLanguage, &ul.DisplayLanguage, &ul.IsActive, &ul.CreatedAt, &ul.UpdatedAt); err != nil {
			return nil, fmt.Errorf("auth: scan user language: %w", err)
		}
		out = append(out, ul)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("auth: list user languages rows: %w", err)
	}
	return out, nil
}

// activeUserLanguage returns the active UserLanguage for a user, if any.
func (s *Service) activeUserLanguage(ctx context.Context, userID string) (UserLanguage, error) {
	var ul UserLanguage
	err := s.pool.QueryRow(ctx, `
		select user_id::text, target_language, display_language, is_active, created_at, updated_at
		from user_languages
		where user_id = $1::uuid and is_active = true
	`, userID).Scan(&ul.UserID, &ul.TargetLanguage, &ul.DisplayLanguage, &ul.IsActive, &ul.CreatedAt, &ul.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return UserLanguage{}, nil
		}
		return UserLanguage{}, fmt.Errorf("auth: load active user language: %w", err)
	}
	return ul, nil
}

// AddUserLanguage adds a new learning pair for a user. If setActive is true or
// this is the user's first pair, it becomes the active pair.
func (s *Service) AddUserLanguage(ctx context.Context, userID, targetLang, displayLang string, setActive bool) (UserLanguage, error) {
	targetLang, err := s.resolveTargetLang(targetLang)
	if err != nil {
		return UserLanguage{}, err
	}
	displayLang, err = s.resolveDefinitionLang(displayLang)
	if err != nil {
		return UserLanguage{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return UserLanguage{}, fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var count int
	if err := tx.QueryRow(ctx, `
		select count(*) from user_languages where user_id = $1::uuid
	`, userID).Scan(&count); err != nil {
		return UserLanguage{}, fmt.Errorf("auth: count user languages: %w", err)
	}
	makeActive := setActive || count == 0

	if makeActive {
		_, err = tx.Exec(ctx, `
			update user_languages set is_active = false, updated_at = now()
			where user_id = $1::uuid and is_active = true
		`, userID)
		if err != nil {
			return UserLanguage{}, fmt.Errorf("auth: deactivate user languages: %w", err)
		}
	}

	var ul UserLanguage
	err = tx.QueryRow(ctx, `
		insert into user_languages (user_id, target_language, display_language, is_active)
		values ($1::uuid, $2, $3, $4)
		returning user_id::text, target_language, display_language, is_active, created_at, updated_at
	`, userID, targetLang, displayLang, makeActive).Scan(&ul.UserID, &ul.TargetLanguage, &ul.DisplayLanguage, &ul.IsActive, &ul.CreatedAt, &ul.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return UserLanguage{}, fmt.Errorf("auth: target language %s already exists for user", targetLang)
		}
		return UserLanguage{}, fmt.Errorf("auth: insert user language: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return UserLanguage{}, fmt.Errorf("auth: commit add user language: %w", err)
	}
	return ul, nil
}

// SetActiveUserLanguage marks the given target language as active for the user.
func (s *Service) SetActiveUserLanguage(ctx context.Context, userID, targetLang string) error {
	targetLang, err := s.resolveTargetLang(targetLang)
	if err != nil {
		return err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists(select 1 from user_languages where user_id = $1::uuid and target_language = $2)
	`, userID, targetLang).Scan(&exists); err != nil {
		return fmt.Errorf("auth: check user language: %w", err)
	}
	if !exists {
		return ErrLanguageNotFound
	}

	_, err = tx.Exec(ctx, `
		update user_languages set is_active = false, updated_at = now()
		where user_id = $1::uuid and is_active = true
	`, userID)
	if err != nil {
		return fmt.Errorf("auth: deactivate user languages: %w", err)
	}

	_, err = tx.Exec(ctx, `
		update user_languages set is_active = true, updated_at = now()
		where user_id = $1::uuid and target_language = $2
	`, userID, targetLang)
	if err != nil {
		return fmt.Errorf("auth: activate user language: %w", err)
	}

	return tx.Commit(ctx)
}

// UpdateUserLanguageDisplayLang changes the display language for an existing target.
func (s *Service) UpdateUserLanguageDisplayLang(ctx context.Context, userID, targetLang, displayLang string) error {
	targetLang, err := s.resolveTargetLang(targetLang)
	if err != nil {
		return err
	}
	displayLang, err = s.resolveDefinitionLang(displayLang)
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx, `
		update user_languages
		set display_language = $3, updated_at = now()
		where user_id = $1::uuid and target_language = $2
	`, userID, targetLang, displayLang)
	if err != nil {
		return fmt.Errorf("auth: update display language: %w", err)
	}
	return nil
}

// RemoveUserLanguage deletes a learning pair. If it was active, the oldest
// remaining pair becomes active.
func (s *Service) RemoveUserLanguage(ctx context.Context, userID, targetLang string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var wasActive bool
	if err := tx.QueryRow(ctx, `
		select is_active from user_languages
		where user_id = $1::uuid and target_language = $2
	`, userID, targetLang).Scan(&wasActive); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrLanguageNotFound
		}
		return fmt.Errorf("auth: check user language: %w", err)
	}

	_, err = tx.Exec(ctx, `
		delete from user_languages
		where user_id = $1::uuid and target_language = $2
	`, userID, targetLang)
	if err != nil {
		return fmt.Errorf("auth: delete user language: %w", err)
	}

	if wasActive {
		_, err = tx.Exec(ctx, `
			update user_languages ul
			set is_active = true, updated_at = now()
			from (
				select user_id, target_language
				from user_languages
				where user_id = $1::uuid
				order by created_at asc, target_language asc
				limit 1
			) next_lang
			where ul.user_id = next_lang.user_id
			  and ul.target_language = next_lang.target_language
		`, userID)
		if err != nil {
			return fmt.Errorf("auth: activate fallback language: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// GetUILanguage returns the user's app interface language.
func (s *Service) GetUILanguage(ctx context.Context, userID string) (string, error) {
	var lang string
	err := s.pool.QueryRow(ctx, `
		select ui_language from users where id = $1::uuid
	`, userID).Scan(&lang)
	if err != nil {
		return "", fmt.Errorf("auth: get ui language: %w", err)
	}
	return lang, nil
}

// SetUILanguage updates the user's app interface language.
func (s *Service) SetUILanguage(ctx context.Context, userID, requested string) error {
	lang, err := s.resolveUILang(requested)
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx, `
		update users set ui_language = $2, updated_at = now() where id = $1::uuid
	`, userID, lang)
	if err != nil {
		return fmt.Errorf("auth: set ui language: %w", err)
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
