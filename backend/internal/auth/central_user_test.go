package auth

import (
	"context"
	"testing"
)

func TestEnsureCentralUser_AutoLinksSameEmail(t *testing.T) {
	svc := testServiceWithOptions(t, Options{
		DefaultDefinitionLang: "ko",
		DefaultTargetLang:     "en",
		DefaultUILang:         "en",
	})
	ctx := context.Background()
	email := uniqueEmail("autolink")

	google1 := SessionFromCentralUser(CentralUser{ID: "central-1", Email: email}, "google")
	first, err := svc.EnsureCentralUser(ctx, google1)
	if err != nil {
		t.Fatalf("first ensure: %v", err)
	}

	google2 := SessionFromCentralUser(CentralUser{ID: "central-2", Email: email}, "google")
	second, err := svc.EnsureCentralUser(ctx, google2)
	if err != nil {
		t.Fatalf("second ensure: %v", err)
	}
	if second.User.ID != first.User.ID {
		t.Fatalf("expected same user id, got %s vs %s", second.User.ID, first.User.ID)
	}
}

func TestMergeUsers_UnionWordLists(t *testing.T) {
	svc := testService(t)
	ctx := context.Background()

	targetEmail := uniqueEmail("merge-target")
	sourceEmail := uniqueEmail("merge-source")

	targetSession := SessionFromCentralUser(CentralUser{ID: "target-central", Email: targetEmail}, "google")
	sourceSession := SessionFromCentralUser(CentralUser{ID: "source-central", Email: sourceEmail}, "google")

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
