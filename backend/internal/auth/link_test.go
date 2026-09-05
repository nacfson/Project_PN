package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

type fakeMagicLinks struct {
	mu    sync.Mutex
	calls []struct{ email, rd string }
	err   error
}

func (f *fakeMagicLinks) SendMagicLink(_ context.Context, email, redirectURL string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, struct{ email, rd string }{email, redirectURL})
	return f.err
}

func (f *fakeMagicLinks) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func TestCreateConfirmLinkRequest_RequiresEmailSession(t *testing.T) {
	mailer := &fakeMagicLinks{}
	svc := testServiceWithOptions(t, Options{
		DefaultDefinitionLang:  "ko",
		DefaultTargetLang:      "en",
		DefaultUILang:          "en",
		MagicLinkSender:        mailer,
		PublicAppURL:           "http://localhost:8081",
	})
	ctx := context.Background()
	email := uniqueEmail("link-flow")

	magic := SessionFromCentralUser(CentralUser{ID: "central-link-1", Email: email}, "magic_link")
	first, err := svc.EnsureCentralUser(ctx, magic)
	if err != nil {
		t.Fatalf("first ensure: %v", err)
	}
	if first.SessionProvider != ProviderNacfson {
		t.Fatalf("expected nacfson session provider, got %q", first.SessionProvider)
	}

	google := SessionFromCentralUser(CentralUser{ID: "central-link-1", Email: email}, "google")
	second, err := svc.EnsureCentralUser(ctx, google)
	if err != nil {
		t.Fatalf("second ensure: %v", err)
	}
	if second.PendingIdentity == nil {
		t.Fatal("expected pending identity")
	}
	if second.SessionProvider != ProviderGoogle {
		t.Fatalf("expected google session provider, got %q", second.SessionProvider)
	}

	req, err := svc.CreateLinkRequest(ctx, second.User.ID, *second.PendingIdentity)
	if err != nil {
		t.Fatalf("create link request: %v", err)
	}
	if req.Status != "pending" {
		t.Fatalf("expected pending, got %s", req.Status)
	}
	if mailer.count() != 1 {
		t.Fatalf("expected 1 magic link send, got %d", mailer.count())
	}

	// Google (pending) session cannot confirm.
	err = svc.ConfirmLinkRequest(ctx, second.User.ID, second.SessionProvider, second.User.Email, req.ID)
	if !errors.Is(err, ErrLinkConfirmForbidden) {
		t.Fatalf("expected ErrLinkConfirmForbidden, got %v", err)
	}

	// Email magic-link session can confirm.
	err = svc.ConfirmLinkRequest(ctx, first.User.ID, first.SessionProvider, first.User.Email, req.ID)
	if err != nil {
		t.Fatalf("confirm link request: %v", err)
	}

	third, err := svc.EnsureCentralUser(ctx, google)
	if err != nil {
		t.Fatalf("third ensure: %v", err)
	}
	if third.LinkRecommendation != nil || third.PendingIdentity != nil {
		t.Fatal("expected no recommendation after confirm")
	}
	linked, err := svc.ListLinkedProviders(ctx, first.User.ID)
	if err != nil {
		t.Fatalf("list linked: %v", err)
	}
	if len(linked) < 2 {
		t.Fatalf("expected both providers linked, got %#v", linked)
	}
}

func TestCreateLinkRequest_RequiresPending(t *testing.T) {
	svc := testServiceWithOptions(t, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
		MagicLinkSender:       &fakeMagicLinks{},
		PublicAppURL:          "http://localhost:8081",
	})
	_, err := svc.CreateLinkRequest(context.Background(), "00000000-0000-0000-0000-000000000099", PendingIdentity{})
	if !errors.Is(err, ErrNoPendingIdentity) {
		t.Fatalf("expected ErrNoPendingIdentity, got %v", err)
	}
}

func TestResendLinkRequest_Cooldown(t *testing.T) {
	mailer := &fakeMagicLinks{}
	svc := testServiceWithOptions(t, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
		MagicLinkSender:       mailer,
		PublicAppURL:          "http://localhost:8081",
	})
	ctx := context.Background()
	email := uniqueEmail("link-resend")

	magic := SessionFromCentralUser(CentralUser{ID: "central-resend", Email: email}, "magic_link")
	first, err := svc.EnsureCentralUser(ctx, magic)
	if err != nil {
		t.Fatalf("ensure magic: %v", err)
	}
	google := SessionFromCentralUser(CentralUser{ID: "central-resend", Email: email}, "google")
	second, err := svc.EnsureCentralUser(ctx, google)
	if err != nil {
		t.Fatalf("ensure google: %v", err)
	}
	req, err := svc.CreateLinkRequest(ctx, second.User.ID, *second.PendingIdentity)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.ResendLinkRequest(ctx, second.User.ID, req.ID)
	if !errors.Is(err, ErrLinkResendCooldown) {
		t.Fatalf("expected cooldown, got %v", err)
	}
	_ = first
}

func TestCancelLinkRequest(t *testing.T) {
	mailer := &fakeMagicLinks{}
	svc := testServiceWithOptions(t, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
		MagicLinkSender:       mailer,
		PublicAppURL:          "http://localhost:8081",
	})
	ctx := context.Background()
	email := uniqueEmail("link-cancel")

	_ = SessionFromCentralUser(CentralUser{ID: "central-cancel", Email: email}, "magic_link")
	magic := SessionFromCentralUser(CentralUser{ID: "central-cancel", Email: email}, "magic_link")
	first, err := svc.EnsureCentralUser(ctx, magic)
	if err != nil {
		t.Fatalf("ensure: %v", err)
	}
	google := SessionFromCentralUser(CentralUser{ID: "central-cancel", Email: email}, "google")
	second, err := svc.EnsureCentralUser(ctx, google)
	if err != nil {
		t.Fatalf("ensure google: %v", err)
	}
	req, err := svc.CreateLinkRequest(ctx, second.User.ID, *second.PendingIdentity)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := svc.CancelLinkRequest(ctx, second.User.ID, second.SessionProvider, req.ID); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	err = svc.ConfirmLinkRequest(ctx, first.User.ID, first.SessionProvider, first.User.Email, req.ID)
	if !errors.Is(err, ErrLinkRequestNotFound) {
		t.Fatalf("expected not found after cancel, got %v", err)
	}
}

func TestConfirmLinkRequest_Expired(t *testing.T) {
	mailer := &fakeMagicLinks{}
	svc := testServiceWithOptions(t, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
		MagicLinkSender:       mailer,
		PublicAppURL:          "http://localhost:8081",
	})
	ctx := context.Background()
	email := uniqueEmail("link-expire")

	magic := SessionFromCentralUser(CentralUser{ID: "central-expire", Email: email}, "magic_link")
	first, err := svc.EnsureCentralUser(ctx, magic)
	if err != nil {
		t.Fatalf("ensure: %v", err)
	}
	google := SessionFromCentralUser(CentralUser{ID: "central-expire", Email: email}, "google")
	second, err := svc.EnsureCentralUser(ctx, google)
	if err != nil {
		t.Fatalf("ensure google: %v", err)
	}
	req, err := svc.CreateLinkRequest(ctx, second.User.ID, *second.PendingIdentity)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.pool.Exec(ctx, `
		update account_link_requests set expires_at = $2 where id = $1::uuid
	`, req.ID, time.Now().Add(-time.Minute))
	if err != nil {
		t.Fatalf("expire row: %v", err)
	}
	err = svc.ConfirmLinkRequest(ctx, first.User.ID, first.SessionProvider, first.User.Email, req.ID)
	if !errors.Is(err, ErrLinkRequestExpired) {
		t.Fatalf("expected expired, got %v", err)
	}
}
