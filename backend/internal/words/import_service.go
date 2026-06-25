package words

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

// PreviewAnkiImport inspects Anki cards and reports match/conflict state without
// modifying any data.
func (s *Service) PreviewAnkiImport(ctx context.Context, userID string, req AnkiImportRequest) (ImportPreviewResult, error) {
	langCode, defLangCode, err := s.fillLangs(ctx, userID, req.LanguageCode, req.DefinitionLanguageCode)
	if err != nil {
		return ImportPreviewResult{}, err
	}

	result := ImportPreviewResult{Items: make([]ImportPreviewItem, 0, len(req.Cards))}
	for i, card := range req.Cards {
		front := strings.TrimSpace(card.Front)
		back := strings.TrimSpace(card.Back)
		if front == "" || back == "" {
			continue
		}

		item := ImportPreviewItem{
			Index: i,
			Front: front,
			Back:  back,
		}

		lookupResult, err := s.Lookup(ctx, userID, front, langCode, defLangCode, nil)
		if err != nil {
			// If lookup failed entirely, treat as a new word the user can try to add.
			item.Status = ImportStatusNewWord
			item.SuggestedAction = ImportActionAdd
			result.Items = append(result.Items, item)
			continue
		}

		if len(lookupResult.SenseOptions) == 0 {
			item.Status = ImportStatusNewWord
			item.SuggestedAction = ImportActionAdd
			result.Items = append(result.Items, item)
			continue
		}

		matched := findBestMatchingSense(lookupResult.SenseOptions, back)
		item.MatchedSenses = lookupResult.SenseOptions
		if matched != nil {
			exists, err := s.userHasSense(ctx, userID, matched.WordSenseID)
			if err != nil {
				item.Status = ImportStatusConflict
				item.SuggestedAction = ImportActionSkip
			} else if exists {
				item.Status = ImportStatusConflict
				item.SuggestedAction = ImportActionOverwriteMeaning
			} else {
				item.Status = ImportStatusExistingWordMatch
				item.SuggestedAction = ImportActionAdd
			}
		} else {
			item.Status = ImportStatusConflict
			item.SuggestedAction = ImportActionCreateNewMeaning
		}
		result.Items = append(result.Items, item)
	}

	return result, nil
}

// ImportAnkiCards imports Anki cards into the user's learning list. It respects
// the action field on each card when present; otherwise it falls back to the
// suggested action from PreviewAnkiImport.
func (s *Service) ImportAnkiCards(ctx context.Context, userID string, req AnkiImportRequest) (AnkiImportResult, error) {
	langCode, defLangCode, err := s.fillLangs(ctx, userID, req.LanguageCode, req.DefinitionLanguageCode)
	if err != nil {
		return AnkiImportResult{}, err
	}
	preview, err := s.PreviewAnkiImport(ctx, userID, req)
	if err != nil {
		return AnkiImportResult{}, fmt.Errorf("anki import: preview failed: %w", err)
	}

	result := AnkiImportResult{Total: len(preview.Items)}
	for _, item := range preview.Items {
		card := req.Cards[item.Index]
		action := strings.TrimSpace(card.Action)
		if action == "" {
			action = item.SuggestedAction
		}

		switch action {
		case ImportActionAdd:
			imported, err := s.importAdd(ctx, userID, langCode, defLangCode, item)
			if err != nil {
				result.recordError(item.Index, item.Front, err)
				continue
			}
			if imported {
				result.Imported++
			}
		case ImportActionOverwriteMeaning:
			imported, err := s.importOverwriteMeaning(ctx, userID, langCode, defLangCode, item)
			if err != nil {
				result.recordError(item.Index, item.Front, err)
				continue
			}
			if imported {
				result.Imported++
			}
		case ImportActionCreateNewMeaning:
			imported, err := s.importCreateNewMeaning(ctx, userID, langCode, defLangCode, item)
			if err != nil {
				result.recordError(item.Index, item.Front, err)
				continue
			}
			if imported {
				result.Imported++
			}
		case ImportActionSkip:
			result.Skipped++
		default:
			result.recordError(item.Index, item.Front, fmt.Errorf("unknown action %q", action))
		}
	}

	return result, nil
}

func (s *Service) importAdd(ctx context.Context, userID, langCode, defLangCode string, item ImportPreviewItem) (bool, error) {
	// If the preview found a matching sense, add it directly.
	matched := findBestMatchingSense(item.MatchedSenses, item.Back)
	if matched != nil {
		_, err := s.AddLearningItem(ctx, userID, matched.WordSenseID, defLangCode)
		if err != nil {
			return false, err
		}
		return true, nil
	}

	// No existing word/sense — create one from the Anki data.
	wordSenseID, err := s.createWordAndSenseFromAnki(ctx, userID, langCode, defLangCode, item.Front, item.Back)
	if err != nil {
		return false, err
	}
	_, err = s.AddLearningItem(ctx, userID, wordSenseID, defLangCode)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) importOverwriteMeaning(ctx context.Context, userID, langCode, defLangCode string, item ImportPreviewItem) (bool, error) {
	matched := findBestMatchingSense(item.MatchedSenses, item.Back)
	if matched == nil && len(item.MatchedSenses) > 0 {
		matched = &item.MatchedSenses[0]
	}
	if matched == nil {
		// No existing sense to overwrite; fall back to creating a new word+sense.
		return s.importAdd(ctx, userID, langCode, defLangCode, item)
	}

	// Update the global sense definition. This affects all users referencing the
	// sense, matching the user's request to overwrite the meaning.
	if _, err := s.pool.Exec(ctx,
		`update word_senses set definition = $1, updated_at = now() where id = $2::uuid`,
		item.Back, matched.WordSenseID,
	); err != nil {
		return false, fmt.Errorf("anki import: overwrite meaning: %w", err)
	}

	exists, err := s.userHasSense(ctx, userID, matched.WordSenseID)
	if err != nil {
		return false, err
	}
	if !exists {
		_, err = s.AddLearningItem(ctx, userID, matched.WordSenseID, defLangCode)
		if err != nil {
			return false, err
		}
	}
	return true, nil
}

func (s *Service) importCreateNewMeaning(ctx context.Context, userID, langCode, defLangCode string, item ImportPreviewItem) (bool, error) {
	var wordID string
	if len(item.MatchedSenses) > 0 {
		wordID = item.MatchedSenses[0].WordID
	}

	if wordID == "" {
		// No existing word; create both.
		return s.importAdd(ctx, userID, langCode, defLangCode, item)
	}

	wordSenseID, err := s.appendSenseToWord(ctx, wordID, defLangCode, item.Back)
	if err != nil {
		return false, err
	}

	_, err = s.AddLearningItem(ctx, userID, wordSenseID, defLangCode)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) createWordAndSenseFromAnki(ctx context.Context, userID, langCode, defLangCode, front, back string) (string, error) {
	normalized := normalize(front)

	// First try the enricher so we get a proper POS, examples, and canonical data.
	lookupResult, err := s.Lookup(ctx, userID, front, langCode, defLangCode, nil)
	if err == nil && len(lookupResult.SenseOptions) > 0 {
		matched := findBestMatchingSense(lookupResult.SenseOptions, back)
		if matched != nil {
			return matched.WordSenseID, nil
		}
		// Word exists but no matching sense; append a new one.
		return s.appendSenseToWord(ctx, lookupResult.SenseOptions[0].WordID, defLangCode, back)
	}

	// Enricher unavailable or lookup failed: create a minimal word + sense.
	if err != nil {
		slog.Warn("anki import: enricher lookup failed, creating minimal word",
			"word", front, "error", err)
	}

	var wordID string
	err = s.pool.QueryRow(ctx, `
		insert into words (language_code, lemma, normalized_text, part_of_speech)
		values ($1, $2, $3, 'unknown')
		on conflict (language_code, normalized_text, part_of_speech)
		do update set updated_at = now()
		returning id::text`,
		langCode, front, normalized,
	).Scan(&wordID)
	if err != nil {
		return "", fmt.Errorf("anki import: create word: %w", err)
	}

	return s.appendSenseToWord(ctx, wordID, defLangCode, back)
}

func (s *Service) appendSenseToWord(ctx context.Context, wordID, defLangCode, definition string) (string, error) {
	var maxOrder int
	if err := s.pool.QueryRow(ctx,
		`select coalesce(max(meaning_order), 0) from word_senses where word_id = $1::uuid`, wordID,
	).Scan(&maxOrder); err != nil {
		return "", fmt.Errorf("anki import: max meaning_order: %w", err)
	}

	var wordSenseID string
	if err := s.pool.QueryRow(ctx, `
		insert into word_senses (word_id, definition, meaning_order)
		values ($1::uuid, $2, $3)
		returning id::text`,
		wordID, definition, maxOrder+1,
	).Scan(&wordSenseID); err != nil {
		return "", fmt.Errorf("anki import: create sense: %w", err)
	}
	return wordSenseID, nil
}

func (s *Service) userHasSense(ctx context.Context, userID, wordSenseID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		select exists(
			select 1 from user_word_senses
			where user_id = $1::uuid and word_sense_id = $2::uuid and archived_at is null
		)`, userID, wordSenseID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("anki import: check user sense: %w", err)
	}
	return exists, nil
}

func (r *AnkiImportResult) recordError(index int, front string, err error) {
	r.Failed++
	r.Errors = append(r.Errors, ImportError{
		Index: index,
		Front: front,
		Error: err.Error(),
	})
}

// findBestMatchingSense returns the first sense whose definition is a case-
// insensitive match or contains the Anki back text (or vice versa).
func findBestMatchingSense(options []SenseOption, back string) *SenseOption {
	backNorm := strings.ToLower(strings.TrimSpace(back))
	if backNorm == "" {
		return nil
	}
	for i := range options {
		def := strings.ToLower(strings.TrimSpace(options[i].Definition))
		if def == backNorm || strings.Contains(def, backNorm) || strings.Contains(backNorm, def) {
			if def != "" {
				return &options[i]
			}
		}
	}
	return nil
}
