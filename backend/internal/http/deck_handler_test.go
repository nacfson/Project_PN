package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/words"
)

func TestDeckCRUD(t *testing.T) {
	router, token, pool, authSvc := validationRouterWithPool(t)
	ctx := context.Background()

	user, err := authSvc.Authenticate(ctx, token)
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}

	// List decks ensures a default deck for the active language.
	listReq := authRequest(t, http.MethodGet, "/api/decks", "", token)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list decks: expected 200, got %d body=%s", listRec.Code, listRec.Body.String())
	}
	var listRes decksResponse
	if err := json.NewDecoder(listRec.Body).Decode(&listRes); err != nil {
		t.Fatalf("decode deck list: %v", err)
	}
	if len(listRes.Decks) < 1 {
		t.Fatalf("expected at least default deck, got %#v", listRes.Decks)
	}
	var defaultDeck words.Deck
	for _, d := range listRes.Decks {
		if d.IsDefault {
			defaultDeck = d
			break
		}
	}
	if defaultDeck.ID == "" {
		t.Fatal("expected a default deck in list")
	}

	// Create a custom deck.
	createReq := authRequest(t, http.MethodPost, "/api/decks", `{"name":"Custom Deck","target_language":"en"}`, token)
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create deck: expected 201, got %d body=%s", createRec.Code, createRec.Body.String())
	}
	var customDeck words.Deck
	if err := json.NewDecoder(createRec.Body).Decode(&customDeck); err != nil {
		t.Fatalf("decode created deck: %v", err)
	}
	if customDeck.Name != "Custom Deck" {
		t.Fatalf("unexpected deck name: %q", customDeck.Name)
	}

	// Rename deck.
	renameReq := authRequest(t, http.MethodPatch, "/api/decks/"+customDeck.ID, `{"name":"Renamed Deck"}`, token)
	renameRec := httptest.NewRecorder()
	router.ServeHTTP(renameRec, renameReq)
	if renameRec.Code != http.StatusNoContent {
		t.Fatalf("rename deck: expected 204, got %d body=%s", renameRec.Code, renameRec.Body.String())
	}

	// Insert a word and add it to the custom deck.
	senseID := insertDeckFixtureWord(t, pool, "deckcrud")
	addReq := authRequest(t, http.MethodPost, "/api/learning-items", `{"word_sense_id":"`+senseID+`","deck_id":"`+customDeck.ID+`"}`, token)
	addRec := httptest.NewRecorder()
	router.ServeHTTP(addRec, addReq)
	if addRec.Code != http.StatusCreated {
		t.Fatalf("add learning item: expected 201, got %d body=%s", addRec.Code, addRec.Body.String())
	}

	// List by deck should return the item.
	itemsReq := authRequest(t, http.MethodGet, "/api/learning-items?deck_id="+customDeck.ID, "", token)
	itemsRec := httptest.NewRecorder()
	router.ServeHTTP(itemsRec, itemsReq)
	if itemsRec.Code != http.StatusOK {
		t.Fatalf("list by deck: expected 200, got %d body=%s", itemsRec.Code, itemsRec.Body.String())
	}
	var itemsPage words.LearningItemsPage
	if err := json.NewDecoder(itemsRec.Body).Decode(&itemsPage); err != nil {
		t.Fatalf("decode items page: %v", err)
	}
	if len(itemsPage.Items) != 1 {
		t.Fatalf("expected 1 item in custom deck, got %d", len(itemsPage.Items))
	}

	// Delete custom deck moves item to default.
	delReq := authRequest(t, http.MethodDelete, "/api/decks/"+customDeck.ID, "", token)
	delRec := httptest.NewRecorder()
	router.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete deck: expected 204, got %d body=%s", delRec.Code, delRec.Body.String())
	}

	var currentDeck string
	if err := pool.QueryRow(ctx, `
		select d.id::text
		from user_word_senses uws
		join decks d on d.id = uws.deck_id
		where uws.user_id = $1::uuid
	`, user.ID).Scan(&currentDeck); err != nil {
		t.Fatalf("fetch item deck after delete: %v", err)
	}
	if currentDeck != defaultDeck.ID {
		t.Fatalf("expected item moved to default deck %q, got %q", defaultDeck.ID, currentDeck)
	}

	// Deleting the default deck should fail.
	delDefaultReq := authRequest(t, http.MethodDelete, "/api/decks/"+defaultDeck.ID, "", token)
	delDefaultRec := httptest.NewRecorder()
	router.ServeHTTP(delDefaultRec, delDefaultReq)
	if delDefaultRec.Code != http.StatusConflict {
		t.Fatalf("delete default deck: expected 409, got %d body=%s", delDefaultRec.Code, delDefaultRec.Body.String())
	}
}

func TestDeckMoveItemsRequiresMatchingLanguage(t *testing.T) {
	router, token, pool, authSvc := validationRouterWithPool(t)
	ctx := context.Background()

	user, err := authSvc.Authenticate(ctx, token)
	if err != nil {
		t.Fatalf("authenticate: %v", err)
	}

	// Add a second language pair so we can create a deck for it.
	if _, err := authSvc.AddUserLanguage(ctx, user.ID, "es", "en", false); err != nil {
		t.Fatalf("add spanish pair: %v", err)
	}

	svc := words.New(pool, nil, "", "", "")
	if _, err := svc.EnsureDefaultDeck(ctx, user.ID, "en"); err != nil {
		t.Fatalf("ensure english default deck: %v", err)
	}

	custom, err := svc.CreateDeck(ctx, user.ID, "Spanish Deck", "es")
	if err != nil {
		t.Fatalf("create spanish deck: %v", err)
	}

	// Insert an English word and add it to the user's default English deck.
	senseID := insertDeckFixtureWord(t, pool, "englishword")
	var itemID string
	if err := pool.QueryRow(ctx, `
		insert into user_word_senses (user_id, word_sense_id, deck_id)
		select $1::uuid, $2::uuid, d.id
		from decks d
		where d.user_id = $1::uuid and d.target_language = 'en' and d.is_default = true
		returning id::text
	`, user.ID, senseID).Scan(&itemID); err != nil {
		t.Fatalf("insert english item: %v", err)
	}
	if _, err := pool.Exec(ctx, `insert into review_states (user_word_sense_id) values ($1::uuid)`, itemID); err != nil {
		t.Fatalf("insert review state: %v", err)
	}

	// Attempt to move the English item into the Spanish deck.
	moveReq := authRequest(t, http.MethodPost, "/api/decks/"+custom.ID+"/move-items", `{"user_word_sense_ids":["`+itemID+`"]}`, token)
	moveRec := httptest.NewRecorder()
	router.ServeHTTP(moveRec, moveReq)
	if moveRec.Code != http.StatusForbidden {
		t.Fatalf("move mismatched language: expected 403, got %d body=%s", moveRec.Code, moveRec.Body.String())
	}
}

func insertDeckFixtureWord(t *testing.T, pool *pgxpool.Pool, lemma string) string {
	t.Helper()
	ctx := context.Background()
	var wordID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', $1, $1, 'noun')
		returning id::text
	`, lemma).Scan(&wordID); err != nil {
		t.Fatalf("insert word %q: %v", lemma, err)
	}
	var senseID string
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, $2, 1)
		returning id::text
	`, wordID, lemma+" definition").Scan(&senseID); err != nil {
		t.Fatalf("insert sense %q: %v", lemma, err)
	}
	return senseID
}
