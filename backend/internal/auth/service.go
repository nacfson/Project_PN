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
	pool                  *pgxpool.Pool
	mailer                email.Mailer
	sessionTTL            time.Duration
	magicLinkTTL          time.Duration
	exchangeCodeTTL       time.Duration
	defaultDefinitionLang string
	defaultTargetLang     string
	appPublicURL          string
}

type Options struct {
	SessionTTL            time.Duration
	MagicLinkTTL          time.Duration
	ExchangeCodeTTL       time.Duration
	DefaultDefinitionLang string
	DefaultTargetLang     string
	AppPublicURL          string
}

func New(pool *pgxpool.Pool, mailer email.Mailer, opts Options) *Service {
	return &Service{
		pool:                  pool,
		mailer:                mailer,
		sessionTTL:            opts.SessionTTL,
		magicLinkTTL:          opts.MagicLinkTTL,
		exchangeCodeTTL:       opts.ExchangeCodeTTL,
		defaultDefinitionLang: opts.DefaultDefinitionLang,
		defaultTargetLang:     opts.DefaultTargetLang,
		appPublicURL:          opts.AppPublicURL,
	}
}

func (s *Service) AppPublicURL() string {
	return s.appPublicURL
}

// InsertMagicLinkTokenForTest seeds a magic-link token for integration tests.
func (s *Service) InsertMagicLinkTokenForTest(ctx context.Context, userID string) (string, error) {
	plain, hash, err := newOpaqueToken()
	if err != nil {
		return "", err
	}
	_, err = s.pool.Exec(ctx, `
		insert into magic_link_tokens (user_id, token_hash, expires_at)
		values ($1, $2, now() + interval '15 minutes')
	`, userID, hash)
	if err != nil {
		return "", fmt.Errorf("auth: insert test magic link: %w", err)
	}
	return plain, nil
}

func (s *Service) Register(ctx context.Context, emailAddr, password, nativeLang, targetLang string) (Session, error) {
	emailAddr = NormalizeEmail(emailAddr)
	if emailAddr == "" {
		return Session{}, ErrEmailRequired
	}
	if len(password) < 8 {
		return Session{}, ErrWeakPassword
	}
	if nativeLang == "" {
		nativeLang = s.defaultDefinitionLang
	}
	if targetLang == "" {
		targetLang = s.defaultTargetLang
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return Session{}, fmt.Errorf("auth: hash password: %w", err)
	}

	var userID string
	err = s.pool.QueryRow(ctx, `
		insert into users (email, password_hash, native_language, target_language)
		values ($1, $2, $3, $4)
		returning id
	`, emailAddr, string(hash), nativeLang, targetLang).Scan(&userID)
	if err != nil {
		if isUniqueViolation(err) {
			return Session{}, ErrEmailTaken
		}
		return Session{}, fmt.Errorf("auth: insert user: %w", err)
	}

	return s.IssueSession(ctx, userID)
}

func (s *Service) Login(ctx context.Context, emailAddr, password string) (Session, error) {
	emailAddr = NormalizeEmail(emailAddr)
	if emailAddr == "" {
		return Session{}, ErrInvalidCredentials
	}

	var userID, passwordHash string
	err := s.pool.QueryRow(ctx, `
		select id, password_hash
		from users
		where lower(email) = $1
	`, emailAddr).Scan(&userID, &passwordHash)
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

	return s.IssueSession(ctx, userID)
}

func (s *Service) LoginWithOAuth(ctx context.Context, provider, subject, email string, emailVerified bool) (Session, error) {
	email = NormalizeEmail(email)
	if subject == "" || provider == "" {
		return Session{}, ErrOAuthInvalid
	}

	var userID string
	err := s.pool.QueryRow(ctx, `
		select user_id
		from user_identities
		where provider = $1 and provider_subject = $2
	`, provider, subject).Scan(&userID)
	if err == nil {
		return s.IssueSession(ctx, userID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Session{}, fmt.Errorf("auth: oauth identity lookup: %w", err)
	}

	if email != "" {
		var existingUserID string
		var verifiedAt *time.Time
		err = s.pool.QueryRow(ctx, `
			select id, email_verified_at
			from users
			where lower(email) = $1
		`, email).Scan(&existingUserID, &verifiedAt)
		if err == nil {
			if !emailVerified {
				return Session{}, ErrOAuthCannotLink
			}
			session, linkErr := s.linkOAuthIdentity(ctx, provider, subject, email, existingUserID, verifiedAt == nil)
			if linkErr != nil {
				return Session{}, linkErr
			}
			return session, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return Session{}, fmt.Errorf("auth: oauth user lookup: %w", err)
		}
	}

	if email == "" {
		return Session{}, ErrOAuthInvalid
	}

	return s.createOAuthUser(ctx, provider, subject, email, emailVerified)
}

func (s *Service) linkOAuthIdentity(ctx context.Context, provider, subject, email, userID string, setVerified bool) (Session, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Session{}, fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		insert into user_identities (user_id, provider, provider_subject, email_at_provider)
		values ($1, $2, $3, $4)
	`, userID, provider, subject, email); err != nil {
		if isUniqueViolation(err) {
			return Session{}, ErrOAuthInvalid
		}
		return Session{}, fmt.Errorf("auth: insert oauth identity: %w", err)
	}

	if setVerified {
		now := time.Now()
		if _, err := tx.Exec(ctx, `
			update users
			set email_verified_at = coalesce(email_verified_at, $2), updated_at = $2
			where id = $1
		`, userID, now); err != nil {
			return Session{}, fmt.Errorf("auth: verify email on oauth link: %w", err)
		}
	}

	session, err := s.issueSessionTx(ctx, tx, userID)
	if err != nil {
		return Session{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Session{}, fmt.Errorf("auth: commit oauth link: %w", err)
	}
	return session, nil
}

func (s *Service) createOAuthUser(ctx context.Context, provider, subject, email string, emailVerified bool) (Session, error) {
	nativeLang := s.defaultDefinitionLang
	targetLang := s.defaultTargetLang

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Session{}, fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string
	if emailVerified {
		err = tx.QueryRow(ctx, `
			insert into users (email, native_language, target_language, email_verified_at)
			values ($1, $2, $3, now())
			returning id
		`, email, nativeLang, targetLang).Scan(&userID)
	} else {
		err = tx.QueryRow(ctx, `
			insert into users (email, native_language, target_language)
			values ($1, $2, $3)
			returning id
		`, email, nativeLang, targetLang).Scan(&userID)
	}
	if err != nil {
		if isUniqueViolation(err) {
			return Session{}, ErrOAuthCannotLink
		}
		return Session{}, fmt.Errorf("auth: insert oauth user: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		insert into user_identities (user_id, provider, provider_subject, email_at_provider)
		values ($1, $2, $3, $4)
	`, userID, provider, subject, email); err != nil {
		return Session{}, fmt.Errorf("auth: insert oauth identity: %w", err)
	}

	session, err := s.issueSessionTx(ctx, tx, userID)
	if err != nil {
		return Session{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Session{}, fmt.Errorf("auth: commit oauth signup: %w", err)
	}
	return session, nil
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
		select u.id, u.email, u.email_verified_at, u.native_language, u.target_language
		from sessions s
		join users u on u.id = s.user_id
		where s.token_hash = $1 and s.expires_at > now()
	`, hash).Scan(&user.ID, &user.Email, &verifiedAt, &user.NativeLanguage, &user.TargetLanguage)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrInvalidToken
		}
		return User{}, fmt.Errorf("auth: authenticate: %w", err)
	}
	user.EmailVerifiedAt = verifiedAt
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

func (s *Service) SendMagicLink(ctx context.Context, emailAddr string) error {
	emailAddr = NormalizeEmail(emailAddr)
	if emailAddr == "" {
		return nil
	}

	var userID string
	err := s.pool.QueryRow(ctx, `
		select id from users where lower(email) = $1
	`, emailAddr).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("auth: lookup user for magic link: %w", err)
	}

	plain, hash, err := newOpaqueToken()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(s.magicLinkTTL)

	_, err = s.pool.Exec(ctx, `
		insert into magic_link_tokens (user_id, token_hash, expires_at)
		values ($1, $2, $3)
	`, userID, hash, expiresAt)
	if err != nil {
		return fmt.Errorf("auth: insert magic link token: %w", err)
	}

	consumeURL := fmt.Sprintf("%s/api/auth/magic/consume?token=%s", s.appPublicURL, plain)
	return s.mailer.Send(ctx, email.Message{
		To:      emailAddr,
		Subject: "Your Project PN sign-in link",
		Body:    fmt.Sprintf("Sign in to Project PN:\n\n%s\n\nThis link expires in %s.", consumeURL, s.magicLinkTTL),
	})
}

func (s *Service) ConsumeMagicLink(ctx context.Context, token string) (exchangeCode string, err error) {
	if token == "" {
		return "", ErrInvalidToken
	}

	_, _ = s.pool.Exec(ctx, `
		delete from magic_link_tokens
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
		from magic_link_tokens
		where token_hash = $1
		  and expires_at > now()
		  and consumed_at is null
		for update
	`, hash).Scan(&tokenID, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidToken
		}
		return "", fmt.Errorf("auth: consume magic link lookup: %w", err)
	}

	now := time.Now()
	if _, err := tx.Exec(ctx, `
		update magic_link_tokens set consumed_at = $2 where id = $1
	`, tokenID, now); err != nil {
		return "", fmt.Errorf("auth: mark magic link consumed: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		update users set email_verified_at = coalesce(email_verified_at, $2), updated_at = $2
		where id = $1
	`, userID, now); err != nil {
		return "", fmt.Errorf("auth: verify email: %w", err)
	}

	plain, codeHash, err := newOpaqueToken()
	if err != nil {
		return "", err
	}
	expiresAt := now.Add(s.exchangeCodeTTL)
	if _, err := tx.Exec(ctx, `
		insert into magic_login_exchanges (user_id, code_hash, expires_at)
		values ($1, $2, $3)
	`, userID, codeHash, expiresAt); err != nil {
		return "", fmt.Errorf("auth: insert exchange code: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("auth: commit consume: %w", err)
	}

	return plain, nil
}

func (s *Service) ExchangeMagicCode(ctx context.Context, code string) (Session, error) {
	if code == "" {
		return Session{}, ErrInvalidToken
	}

	_, _ = s.pool.Exec(ctx, `
		delete from magic_login_exchanges
		where expires_at < now() or consumed_at is not null
	`)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Session{}, fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	hash := hashToken(code)
	var userID string
	var exchangeID string
	err = tx.QueryRow(ctx, `
		select id, user_id
		from magic_login_exchanges
		where code_hash = $1
		  and expires_at > now()
		  and consumed_at is null
		for update
	`, hash).Scan(&exchangeID, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Session{}, ErrInvalidToken
		}
		return Session{}, fmt.Errorf("auth: exchange lookup: %w", err)
	}

	now := time.Now()
	if _, err := tx.Exec(ctx, `
		update magic_login_exchanges set consumed_at = $2 where id = $1
	`, exchangeID, now); err != nil {
		return Session{}, fmt.Errorf("auth: mark exchange consumed: %w", err)
	}

	session, err := s.issueSessionTx(ctx, tx, userID)
	if err != nil {
		return Session{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Session{}, fmt.Errorf("auth: commit exchange: %w", err)
	}

	return session, nil
}

func (s *Service) issueSessionTx(ctx context.Context, q querier, userID string) (Session, error) {
	plain, hash, err := newOpaqueToken()
	if err != nil {
		return Session{}, err
	}
	expiresAt := time.Now().Add(s.sessionTTL)
	if _, err := q.Exec(ctx, `
		insert into sessions (user_id, token_hash, expires_at)
		values ($1, $2, $3)
	`, userID, hash, expiresAt); err != nil {
		return Session{}, fmt.Errorf("auth: insert session: %w", err)
	}
	return Session{Token: plain, ExpiresAt: expiresAt}, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
