package auth

import (
	"context"
	"testing"
)

func TestEnsureCentralUser_LinkRecommendationForSecondProvider(t *testing.T) {
	mailer := &fakeMagicLinks{}
	svc := testServiceWithOptions(t, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
		MagicLinkSender:       mailer,
		PublicAppURL:          "http://localhost:8081",
	})
	ctx := context.Background()
	email := uniqueEmail("link-rec")

	magic := SessionFromCentralUser(CentralUser{ID: "central-1", Email: email}, "magic_link")
	first, err := svc.EnsureCentralUser(ctx, magic)
	if err != nil {
		t.Fatalf("first ensure: %v", err)
	}
	if first.LinkRecommendation != nil {
		t.Fatal("expected no link recommendation on first provider")
	}

	google := SessionFromCentralUser(CentralUser{ID: "central-1", Email: email}, "google")
	second, err := svc.EnsureCentralUser(ctx, google)
	if err != nil {
		t.Fatalf("second ensure: %v", err)
	}
	if second.User.ID != first.User.ID {
		t.Fatalf("expected same user id, got %s vs %s", second.User.ID, first.User.ID)
	}
	if second.LinkRecommendation == nil || second.PendingIdentity == nil {
		t.Fatal("expected link recommendation for second provider")
	}
	if second.LinkRecommendation.Provider != ProviderGoogle {
		t.Fatalf("expected google provider recommendation, got %q", second.LinkRecommendation.Provider)
	}

	req, err := svc.CreateLinkRequest(ctx, second.User.ID, *second.PendingIdentity)
	if err != nil {
		t.Fatalf("create link request: %v", err)
	}
	if err := svc.ConfirmLinkRequest(ctx, first.User.ID, first.SessionProvider, first.User.Email, req.ID); err != nil {
		t.Fatalf("confirm link: %v", err)
	}

	third, err := svc.EnsureCentralUser(ctx, google)
	if err != nil {
		t.Fatalf("third ensure: %v", err)
	}
	if third.LinkRecommendation != nil {
		t.Fatal("expected no link recommendation after linking")
	}
}

func TestMergeUsers_UnionWordLists(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	targetEmail := uniqueEmail("merge-target")
	sourceEmail := uniqueEmail("merge-source")

	targetSession := SessionFromCentralUser(CentralUser{ID: "target-central", Email: targetEmail}, "magic_link")
	sourceSession := SessionFromCentralUser(CentralUser{ID: "source-central", Email: sourceEmail}, "magic_link")

	targetResult, err := svc.EnsureCentralUser(ctx, targetSession)
	if err != nil {
		t.Fatalf("target ensure: %v", err)
	}
	sourceResult, err := svc.EnsureCentralUser(ctx, sourceSession)
	if err != nil {
		t.Fatalf("source ensure: %v", err)
	}

	requestID, err := svc.CreateMergeRequest(ctx, targetResult.User.ID, sourceResult.User.ID, targetResult.User.ID)
	if err != nil {
		t.Fatalf("create merge request: %v", err)
	}
	if err := svc.ConfirmMergeRequest(ctx, targetResult.User.ID, requestID); err != nil {
		t.Fatalf("confirm merge: %v", err)
	}
}
