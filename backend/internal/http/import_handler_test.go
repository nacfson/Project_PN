package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"project-pn/internal/words"
)

func TestAnkiImportPreviewAndImport(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for import handler tests")
	}

	router, token, pool, _ := validationRouterWithPool(t)
	ctx := context.Background()

	// Seed an existing word with a known sense.
	var existingWordID, existingSenseID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', 'run', 'run', 'verb')
		returning id::text
	`).Scan(&existingWordID); err != nil {
		t.Fatalf("insert word fixture: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'to move quickly', 1)
		returning id::text
	`, existingWordID).Scan(&existingSenseID); err != nil {
		t.Fatalf("insert sense fixture: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition, short_definition)
		values ($1::uuid, 'ko', '달리다', '달리다')
	`, existingSenseID); err != nil {
		t.Fatalf("insert translation fixture: %v", err)
	}

	// Seed eat word and sense.
	var eatWordID, eatSenseID string
	if err := pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ('en', 'eat', 'eat', 'verb')
		returning id::text
	`).Scan(&eatWordID); err != nil {
		t.Fatalf("insert eat word fixture: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, 'to consume food', 1)
		returning id::text
	`, eatWordID).Scan(&eatSenseID); err != nil {
		t.Fatalf("insert eat sense fixture: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into sense_translations (word_sense_id, language_code, definition, short_definition)
		values ($1::uuid, 'ko', '먹다', '먹다')
	`, eatSenseID); err != nil {
		t.Fatalf("insert eat translation fixture: %v", err)
	}

	csvBody := `Front,Back,Tags
run,to move quickly,verbs
eat,to consume food,verbs`

	// Preview
	var b bytes.Buffer
	mw := multipart.NewWriter(&b)
	fw, _ := mw.CreateFormFile("file", "deck.csv")
	fw.Write([]byte(csvBody))
	mw.WriteField("language_code", "en")
	mw.WriteField("definition_language_code", "ko")
	mw.Close()

	req := authRequest(t, http.MethodPost, "/api/import/anki/preview", "", token)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Body = io.NopCloser(&b)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("preview expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var preview struct {
		Cards []words.AnkiCard          `json:"cards"`
		Items []words.ImportPreviewItem `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &preview); err != nil {
		t.Fatalf("decode preview: %v", err)
	}
	if len(preview.Cards) != 2 || len(preview.Items) != 2 {
		t.Fatalf("expected 2 cards/items, got %d/%d", len(preview.Cards), len(preview.Items))
	}

	// Resolve actions: overwrite meaning for run, add new word for eat.
	preview.Cards[0].Action = words.ImportActionOverwriteMeaning
	preview.Cards[1].Action = words.ImportActionAdd

	importBody, _ := json.Marshal(words.AnkiImportRequest{
		Cards:                  preview.Cards,
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
	})

	req = authRequest(t, http.MethodPost, "/api/import/anki", string(importBody), token)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("import expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var result words.AnkiImportResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if result.Imported != 2 {
		t.Fatalf("expected 2 imported, got %+v", result)
	}
}

func TestAnkiImportPreviewRejectsMissingFile(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for import handler tests")
	}

	router, token := validationRouter(t)
	req := authRequest(t, http.MethodPost, "/api/import/anki/preview", "", token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing file, got %d", rec.Code)
	}
}

func TestAnkiImportRequiresCards(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL is required for import handler tests")
	}

	router, token := validationRouter(t)
	body := `{"cards":[],"language_code":"en","definition_language_code":"ko"}`
	req := authRequest(t, http.MethodPost, "/api/import/anki", body, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty cards, got %d", rec.Code)
	}
}
