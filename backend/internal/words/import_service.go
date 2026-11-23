package words

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
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

		lookupResult, err := s.Lookup(ctx, userID, front, langCode, defLangCode, "", nil)
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
	addMatched := func(matched *SenseOption) (bool, error) {
		personalNote := ""
		if !matched.HasLocalizedTranslation && defLangCode != langCode {
			personalNote = item.Back
		}
		_, err := s.AddLearningItem(ctx, userID, matched.WordSenseID, defLangCode, "", "", personalNote)
		if err != nil && errors.Is(err, ErrTranslationUnavailable) && personalNote == "" && strings.TrimSpace(item.Back) != "" {
			_, err = s.AddLearningItem(ctx, userID, matched.WordSenseID, defLangCode, "", "", item.Back)
		}
		if err != nil {
			return false, err
		}
		return true, nil
	}

	// If the preview found a matching dictionary sense, add it directly.
	if matched := findBestMatchingSense(item.MatchedSenses, item.Back); matched != nil {
		return addMatched(matched)
	}

	// Only query Lookup when preview produced no senses (e.g. Lookup error in preview); avoid redundant Lookup when MatchedSenses is already populated.
	if len(item.MatchedSenses) == 0 {
		lookupResult, err := s.Lookup(ctx, userID, item.Front, langCode, defLangCode, "", nil)
		if err == nil && len(lookupResult.SenseOptions) > 0 {
			if matched := findBestMatchingSense(lookupResult.SenseOptions, item.Back); matched != nil {
				return addMatched(matched)
			}
		}
	}

	if _, err := s.AddManualLearningItem(ctx, userID, item.Front, "", langCode, defLangCode, "", "", item.Back); err != nil {
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
		// No existing dictionary sense to attach to; store privately in user_personal_meanings.
		return s.importAdd(ctx, userID, langCode, defLangCode, item)
	}

	var existingID string
	err := s.pool.QueryRow(ctx, `
		select id::text
		from user_word_senses
		where user_id = $1::uuid and word_sense_id = $2::uuid and archived_at is null
		limit 1`,
		userID, matched.WordSenseID,
	).Scan(&existingID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return false, fmt.Errorf("anki import: load existing user sense: %w", err)
	}
	if err == nil {
		if _, err := s.SetPersonalNote(ctx, userID, existingID, item.Back); err != nil {
			return false, err
		}
		return true, nil
	}

	if _, err := s.AddLearningItem(ctx, userID, matched.WordSenseID, defLangCode, "", "", item.Back); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) importCreateNewMeaning(ctx context.Context, userID, langCode, defLangCode string, item ImportPreviewItem) (bool, error) {
	if _, err := s.AddManualLearningItem(ctx, userID, item.Front, "", langCode, defLangCode, "", "", item.Back); err != nil {
		return false, err
	}
	return true, nil
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
