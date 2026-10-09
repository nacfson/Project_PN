package auth

import (
	"context"
	"testing"
)

func TestEnsurePlatformUser_ResolvesExistingBinding(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	issuer := "https://auth.nacfson.cloud/realms/platform"
	subject := "sub-existing-user-123"
	email := uniqueEmail("existing")

	// First ensure creates the user
	first, err := svc.EnsurePlatformUser(ctx, issuer, subject, email, "google")
	if err != nil {
		t.Fatalf("first ensure platform user: %v", err)
	}
	if first.User.ID == "" {
		t.Fatalf("expected non-empty user ID")
	}
	if first.User.Email != email {
		t.Fatalf("expected email %q, got %q", email, first.User.Email)
	}

	// Second ensure with same (issuer, subject) resolves to the EXACT same local user_id
	second, err := svc.EnsurePlatformUser(ctx, issuer, subject, email, "google")
	if err != nil {
		t.Fatalf("second ensure platform user: %v", err)
	}
	if second.User.ID != first.User.ID {
		t.Fatalf("expected same user_id %s, got %s", first.User.ID, second.User.ID)
	}
}

func TestEnsurePlatformUser_UnknownSubjectCreatesNewOrdinaryUser(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	issuer := "https://auth.nacfson.cloud/realms/platform"
	sub1 := "sub-user-alpha"
	sub2 := "sub-user-beta"

	res1, err := svc.EnsurePlatformUser(ctx, issuer, sub1, uniqueEmail("alpha"), "google")
	if err != nil {
		t.Fatalf("ensure user 1: %v", err)
	}

	res2, err := svc.EnsurePlatformUser(ctx, issuer, sub2, uniqueEmail("beta"), "google")
	if err != nil {
		t.Fatalf("ensure user 2: %v", err)
	}

	if res1.User.ID == res2.User.ID {
		t.Fatalf("distinct subjects must result in distinct users, got identical user_id %s", res1.User.ID)
	}

	// Verify ordinary capabilities
	caps := OrdinaryCapabilities()
	if len(caps) == 0 {
		t.Fatalf("ordinary capabilities must not be empty")
	}
	for _, c := range caps {
		if c == "admin" || c == "system.admin" {
			t.Fatalf("ordinary capabilities must not include admin roles, found %q", c)
		}
	}
}

func TestEnsurePlatformUser_NoSameEmailAutoLink(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	issuer := "https://auth.nacfson.cloud/realms/platform"
	sharedEmail := uniqueEmail("shared")

	// User 1 signs in with subject-1
	u1, err := svc.EnsurePlatformUser(ctx, issuer, "sub-1", sharedEmail, "google")
	if err != nil {
		t.Fatalf("user 1 ensure: %v", err)
	}

	// User 2 signs in with different subject-2 but claims the same email
	// Under the platform identity contract, email auto-linking is NOT performed.
	u2, err := svc.EnsurePlatformUser(ctx, issuer, "sub-2", sharedEmail, "google")
	if err != nil {
		t.Fatalf("user 2 ensure: %v", err)
	}

	if u1.User.ID == u2.User.ID {
		t.Fatalf("platform identity must not auto-link different subjects with same email")
	}
}
