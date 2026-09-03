package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"github.com/nacfson/central-auth/internal/config"
	"github.com/nacfson/central-auth/internal/session"
	"github.com/nacfson/central-auth/internal/token"
)

const (
	ProviderGoogle     = "google"
	ProviderMagicLink  = "magic_link"
	OAuthStateTTL      = 10 * time.Minute
)

var ErrInvalidState = errors.New("invalid oauth state")
var ErrGoogleNotConfigured = errors.New("google oauth is not configured")

type Identity struct {
	Provider        string
	ProviderSubject string
}

type GoogleService struct {
	pool    *pgxpool.Pool
	cfg     config.Config
	oauth   *oauth2.Config
	session *session.Service
}

func NewGoogleService(pool *pgxpool.Pool, cfg config.Config, sessions *session.Service) *GoogleService {
	svc := &GoogleService{pool: pool, cfg: cfg, session: sessions}
	if cfg.GoogleConfigured() {
		svc.oauth = &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.GoogleRedirectURI,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}
	return svc
}

func (g *GoogleService) Configured() bool {
	return g.oauth != nil
}

func (g *GoogleService) Start(ctx context.Context, redirectURL string) (authURL string, err error) {
	if !g.Configured() {
		return "", ErrGoogleNotConfigured
	}
	state, err := token.Generate()
	if err != nil {
		return "", err
	}
	stateHash := token.Hash(state)
	_, err = g.pool.Exec(ctx, `
		insert into oauth_states (state_hash, redirect_url, expires_at)
		values ($1, $2, $3)
		on conflict (state_hash) do update
		set redirect_url = excluded.redirect_url, expires_at = excluded.expires_at
	`, stateHash, redirectURL, time.Now().Add(OAuthStateTTL))
	if err != nil {
		return "", err
	}
	return g.oauth.AuthCodeURL(state, oauth2.AccessTypeOnline), nil
}

type CompleteResult struct {
	Credentials session.Credentials
	User        session.User
	Identity    Identity
	RedirectURL string
}

func (g *GoogleService) Complete(ctx context.Context, code, state string) (CompleteResult, error) {
	if !g.Configured() {
		return CompleteResult{}, ErrGoogleNotConfigured
	}
	redirectURL, err := g.consumeState(ctx, state)
	if err != nil {
		return CompleteResult{}, err
	}
	issueCookie := shouldIssueCookieForRedirect(redirectURL)

	tokenResp, err := g.oauth.Exchange(ctx, code)
	if err != nil {
		return CompleteResult{}, fmt.Errorf("google token exchange: %w", err)
	}
	profile, err := fetchGoogleProfile(ctx, tokenResp.AccessToken)
	if err != nil {
		return CompleteResult{}, err
	}
	if profile.Sub == "" || profile.Email == "" {
		return CompleteResult{}, session.ErrInvalidToken
	}

	user, err := g.ensureGoogleUser(ctx, profile.Email, profile.Sub)
	if err != nil {
		return CompleteResult{}, err
	}

	creds, err := g.session.CreateSessionForUser(ctx, user, issueCookie, ProviderGoogle, profile.Sub)
	if err != nil {
		return CompleteResult{}, err
	}
	return CompleteResult{
		Credentials: creds,
		User:        user,
		Identity:    Identity{Provider: ProviderGoogle, ProviderSubject: profile.Sub},
		RedirectURL: redirectURL,
	}, nil
}

func (g *GoogleService) consumeState(ctx context.Context, state string) (redirectURL string, err error) {
	state = strings.TrimSpace(state)
	if state == "" {
		return "", ErrInvalidState
	}
	err = g.pool.QueryRow(ctx, `
		delete from oauth_states
		where state_hash = $1 and expires_at > now()
		returning redirect_url
	`, token.Hash(state)).Scan(&redirectURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidState
		}
		return "", err
	}
	return redirectURL, nil
}

type googleProfile struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
}

func fetchGoogleProfile(ctx context.Context, accessToken string) (googleProfile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		return googleProfile{}, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return googleProfile{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return googleProfile{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return googleProfile{}, fmt.Errorf("google userinfo status %d", resp.StatusCode)
	}
	var profile googleProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return googleProfile{}, err
	}
	profile.Email = strings.ToLower(strings.TrimSpace(profile.Email))
	if !profile.EmailVerified {
		return googleProfile{}, session.ErrInvalidToken
	}
	return profile, nil
}

func (g *GoogleService) ensureGoogleUser(ctx context.Context, email, googleSub string) (session.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	isAdmin := g.cfg.IsAdminEmail(email)
	tx, err := g.pool.Begin(ctx)
	if err != nil {
		return session.User{}, err
	}
	defer tx.Rollback(ctx)

	var user session.User
	err = tx.QueryRow(ctx, `
		select u.id::text, lower(u.email), u.is_admin
		from user_identities ui
		join users u on u.id = ui.user_id
		where ui.provider = $1 and ui.provider_subject = $2
	`, ProviderGoogle, googleSub).Scan(&user.ID, &user.Email, &user.IsAdmin)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return session.User{}, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			select id::text, lower(email), is_admin
			from users
			where lower(email) = $1
		`, email).Scan(&user.ID, &user.Email, &user.IsAdmin)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return session.User{}, err
		}
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `
				insert into users (email, is_admin)
				values ($1, $2)
				returning id::text, lower(email), is_admin
			`, email, isAdmin).Scan(&user.ID, &user.Email, &user.IsAdmin)
			if err != nil {
				return session.User{}, err
			}
		} else if isAdmin && !user.IsAdmin {
			_, _ = tx.Exec(ctx, `update users set is_admin = true where id = $1`, user.ID)
			user.IsAdmin = true
		}
		_, err = tx.Exec(ctx, `
			insert into user_identities (user_id, provider, provider_subject, email_at_provider)
			values ($1, $2, $3, $4)
			on conflict (provider, provider_subject) do update
			set email_at_provider = excluded.email_at_provider
		`, user.ID, ProviderGoogle, googleSub, email)
		if err != nil {
			return session.User{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return session.User{}, err
	}
	return user, nil
}

func shouldIssueCookieForRedirect(redirectURL string) bool {
	redirectURL = strings.TrimSpace(redirectURL)
	if redirectURL == "" {
		return true
	}
	parsed, err := url.Parse(redirectURL)
	if err != nil {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}
