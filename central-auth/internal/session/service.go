package session

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nacfson/central-auth/internal/config"
	"github.com/nacfson/central-auth/internal/token"
)

var (
	ErrInvalidToken = errors.New("invalid session")
	ErrNotFound     = errors.New("session not found")
)

type User struct {
	ID      string
	Email   string
	IsAdmin bool
}

type Credentials struct {
	AccessToken  string
	RefreshToken string
	CookieValue  string
	ExpiresAt    time.Time
}

type Session struct {
	ID               string
	User             User
	AccessTokenHash  string
	RefreshTokenHash string
	CookieValue      string
	AccessExpiresAt  time.Time
	RefreshExpiresAt time.Time
	LoginAt          time.Time
	RevokedAt        *time.Time
}

type Service struct {
	pool *pgxpool.Pool
	cfg  config.Config
}

func NewService(pool *pgxpool.Pool, cfg config.Config) *Service {
	return &Service{pool: pool, cfg: cfg}
}

func (s *Service) EnsureUser(ctx context.Context, email string) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return User{}, ErrInvalidToken
	}
	var user User
	err := s.pool.QueryRow(ctx, `
		insert into users (email)
		values ($1)
		on conflict (lower(email)) do update set email = excluded.email
		returning id::text, lower(email), is_admin
	`, email).Scan(&user.ID, &user.Email, &user.IsAdmin)
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func (s *Service) CreateMagicLink(ctx context.Context, email string) (string, error) {
	user, err := s.EnsureUser(ctx, email)
	if err != nil {
		return "", err
	}
	raw, err := token.Generate()
	if err != nil {
		return "", err
	}
	_, err = s.pool.Exec(ctx, `
		insert into magic_link_tokens (user_id, token_hash, expires_at)
		values ($1, $2, $3)
	`, user.ID, token.Hash(raw), time.Now().Add(s.cfg.MagicLinkTTL))
	if err != nil {
		return "", err
	}
	return raw, nil
}

func (s *Service) CompleteMagicLink(ctx context.Context, rawToken string, issueCookie bool) (Credentials, User, error) {
	hash := token.Hash(strings.TrimSpace(rawToken))
	var userID string
	err := s.pool.QueryRow(ctx, `
		select user_id::text
		from magic_link_tokens
		where token_hash = $1
		  and consumed_at is null
		  and expires_at > now()
	`, hash).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Credentials{}, User{}, ErrInvalidToken
		}
		return Credentials{}, User{}, err
	}
	if _, err := s.pool.Exec(ctx, `
		update magic_link_tokens
		set consumed_at = now()
		where token_hash = $1
	`, hash); err != nil {
		return Credentials{}, User{}, err
	}
	user, err := s.getUserByID(ctx, userID)
	if err != nil {
		return Credentials{}, User{}, err
	}
	creds, err := s.createSession(ctx, user, issueCookie)
	return creds, user, err
}

func (s *Service) ValidateAccess(ctx context.Context, accessToken string) (Session, error) {
	session, err := s.getSessionByAccessHash(ctx, token.Hash(strings.TrimSpace(accessToken)))
	if err != nil {
		return Session{}, err
	}
	if session.RevokedAt != nil || !session.AccessExpiresAt.After(time.Now()) {
		return Session{}, ErrInvalidToken
	}
	return session, nil
}

func (s *Service) ValidateCookie(ctx context.Context, cookieValue string) (Session, error) {
	session, err := s.getSessionByCookie(ctx, strings.TrimSpace(cookieValue))
	if err != nil {
		return Session{}, err
	}
	if session.RevokedAt != nil || !session.AccessExpiresAt.After(time.Now()) {
		return Session{}, ErrInvalidToken
	}
	slided, err := s.slideSession(ctx, session)
	if err != nil {
		return Session{}, err
	}
	return slided, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (Credentials, error) {
	session, err := s.getSessionByRefreshHash(ctx, token.Hash(strings.TrimSpace(refreshToken)))
	if err != nil {
		return Credentials{}, err
	}
	if session.RevokedAt != nil || !session.RefreshExpiresAt.After(time.Now()) {
		return Credentials{}, ErrInvalidToken
	}
	if _, err := s.pool.Exec(ctx, `update sessions set revoked_at = now() where id = $1`, session.ID); err != nil {
		return Credentials{}, err
	}
	return s.createSession(ctx, session.User, session.CookieValue != "")
}

func (s *Service) RevokeAccess(ctx context.Context, accessToken string) error {
	_, err := s.pool.Exec(ctx, `
		update sessions
		set revoked_at = now()
		where access_token_hash = $1 and revoked_at is null
	`, token.Hash(strings.TrimSpace(accessToken)))
	return err
}

func (s *Service) RevokeCookie(ctx context.Context, cookieValue string) error {
	_, err := s.pool.Exec(ctx, `
		update sessions
		set revoked_at = now()
		where cookie_value = $1 and revoked_at is null
	`, strings.TrimSpace(cookieValue))
	return err
}

func (s *Service) createSession(ctx context.Context, user User, issueCookie bool) (Credentials, error) {
	accessToken, err := token.Generate()
	if err != nil {
		return Credentials{}, err
	}
	refreshToken, err := token.Generate()
	if err != nil {
		return Credentials{}, err
	}
	cookieValue := ""
	if issueCookie {
		cookieValue, err = token.Generate()
		if err != nil {
			return Credentials{}, err
		}
	}
	now := time.Now()
	accessExpires := now.Add(s.cfg.AccessTokenTTL)
	refreshExpires := now.Add(s.cfg.RefreshTokenTTL)
	_, err = s.pool.Exec(ctx, `
		insert into sessions (
			user_id, access_token_hash, refresh_token_hash, cookie_value,
			access_expires_at, refresh_expires_at, login_at
		) values ($1, $2, $3, nullif($4, ''), $5, $6, $7)
	`, user.ID, token.Hash(accessToken), token.Hash(refreshToken), cookieValue, accessExpires, refreshExpires, now)
	if err != nil {
		return Credentials{}, err
	}
	return Credentials{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		CookieValue:  cookieValue,
		ExpiresAt:    accessExpires,
	}, nil
}

func (s *Service) slideSession(ctx context.Context, session Session) (Session, error) {
	now := time.Now()
	maxDeadline := session.LoginAt.Add(s.cfg.SessionMaxAge)
	candidate := now.Add(s.cfg.SessionIdleTimeout)
	if candidate.After(maxDeadline) {
		candidate = maxDeadline
	}
	if !candidate.After(session.AccessExpiresAt) {
		return session, nil
	}
	_, err := s.pool.Exec(ctx, `
		update sessions
		set access_expires_at = $2
		where id = $1
	`, session.ID, candidate)
	if err != nil {
		return Session{}, err
	}
	session.AccessExpiresAt = candidate
	return session, nil
}

func (s *Service) getSessionByAccessHash(ctx context.Context, hash string) (Session, error) {
	return s.scanSession(ctx, `
		select s.id::text, u.id::text, lower(u.email), u.is_admin,
		       s.access_token_hash, s.refresh_token_hash, coalesce(s.cookie_value, ''),
		       s.access_expires_at, s.refresh_expires_at, s.login_at, s.revoked_at
		from sessions s
		join users u on u.id = s.user_id
		where s.access_token_hash = $1
	`, hash)
}

func (s *Service) getSessionByRefreshHash(ctx context.Context, hash string) (Session, error) {
	return s.scanSession(ctx, `
		select s.id::text, u.id::text, lower(u.email), u.is_admin,
		       s.access_token_hash, s.refresh_token_hash, coalesce(s.cookie_value, ''),
		       s.access_expires_at, s.refresh_expires_at, s.login_at, s.revoked_at
		from sessions s
		join users u on u.id = s.user_id
		where s.refresh_token_hash = $1
	`, hash)
}

func (s *Service) getSessionByCookie(ctx context.Context, cookieValue string) (Session, error) {
	return s.scanSession(ctx, `
		select s.id::text, u.id::text, lower(u.email), u.is_admin,
		       s.access_token_hash, s.refresh_token_hash, coalesce(s.cookie_value, ''),
		       s.access_expires_at, s.refresh_expires_at, s.login_at, s.revoked_at
		from sessions s
		join users u on u.id = s.user_id
		where s.cookie_value = $1
	`, cookieValue)
}

func (s *Service) scanSession(ctx context.Context, query string, arg string) (Session, error) {
	var session Session
	err := s.pool.QueryRow(ctx, query, arg).Scan(
		&session.ID,
		&session.User.ID,
		&session.User.Email,
		&session.User.IsAdmin,
		&session.AccessTokenHash,
		&session.RefreshTokenHash,
		&session.CookieValue,
		&session.AccessExpiresAt,
		&session.RefreshExpiresAt,
		&session.LoginAt,
		&session.RevokedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Session{}, ErrInvalidToken
		}
		return Session{}, err
	}
	return session, nil
}

func (s *Service) getUserByID(ctx context.Context, userID string) (User, error) {
	var user User
	err := s.pool.QueryRow(ctx, `
		select id::text, lower(email), is_admin
		from users
		where id = $1
	`, userID).Scan(&user.ID, &user.Email, &user.IsAdmin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	return user, nil
}
