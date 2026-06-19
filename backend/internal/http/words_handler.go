package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"project-pn/internal/enrich"
	"project-pn/internal/words"
)

var validReviewActivityTypes = map[string]struct{}{
	"word_to_meaning":   {},
	"meaning_to_word":   {},
	"cloze":             {},
	"multiple_choice":   {},
	"typing":            {},
	"speaking":          {},
	"writing":           {},
	"sentence_creation": {},
}

type wordsHandler struct {
	svc *words.Service
}

type lookupRequest struct {
	Text                   string  `json:"text"`
	LanguageCode           string  `json:"language_code"`
	DisplayLanguageCode    string  `json:"display_language_code"`
	DefinitionLanguageCode string  `json:"definition_language_code"` // deprecated: use display_language_code
	PartOfSpeech           string  `json:"part_of_speech"`
	WordID                 *string `json:"word_id"`
	Force                  bool    `json:"force"`
}

func (req lookupRequest) displayLang() string {
	if lang := strings.TrimSpace(req.DisplayLanguageCode); lang != "" {
		return lang
	}
	return req.DefinitionLanguageCode
}

type addLearningItemRequest struct {
	WordSenseID         string `json:"word_sense_id"`
	DisplayLanguageCode string `json:"display_language_code"`
}

func (h *wordsHandler) lookup(w http.ResponseWriter, r *http.Request) {
	var req lookupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Text) == "" && req.WordID == nil {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}

	var pos *string
	if p := strings.TrimSpace(req.PartOfSpeech); p != "" && !strings.EqualFold(p, "any") {
		pos = &p
	}

	wordID := req.WordID
	if wordID != nil && strings.TrimSpace(*wordID) == "" {
		wordID = nil
	}

	displayLang := req.displayLang()

	var (
		result words.LookupResult
		err    error
	)
	if req.Force {
		if wordID == nil && pos == nil {
			writeError(w, http.StatusBadRequest, "force requires a concrete part_of_speech or a word_id")
			return
		}
		result, err = h.svc.ForceGenerate(r.Context(), wordID, req.Text, req.LanguageCode, displayLang, pos)
	} else {
		result, err = h.svc.Lookup(r.Context(), req.Text, req.LanguageCode, displayLang, pos)
	}
	if err != nil {
		h.writeServiceError(w, err)
		return
	}

	if result.SenseOptions == nil {
		result.SenseOptions = []words.SenseOption{}
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *wordsHandler) addLearningItem(w http.ResponseWriter, r *http.Request) {
	var req addLearningItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.WordSenseID) == "" {
		writeError(w, http.StatusBadRequest, "word_sense_id is required")
		return
	}

	item, err := h.svc.AddLearningItem(r.Context(), userIDFromRequest(r), req.WordSenseID, req.DisplayLanguageCode)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (h *wordsHandler) listLearningItems(w http.ResponseWriter, r *http.Request) {
	params, err := parseListLearningItemsParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	page, err := h.svc.ListLearningItems(r.Context(), userIDFromRequest(r), params)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func parseListLearningItemsParams(r *http.Request) (words.ListLearningItemsParams, error) {
	query := r.URL.Query()
	params := words.ListLearningItemsParams{Limit: 50, Descending: true}

	if rawLimit := strings.TrimSpace(query.Get("limit")); rawLimit != "" {
		limit, err := strconv.Atoi(rawLimit)
		if err != nil || limit <= 0 {
			return words.ListLearningItemsParams{}, errors.New("limit must be a positive integer")
		}
		if limit > 100 {
			limit = 100
		}
		params.Limit = limit
	}

	if rawDescending := strings.TrimSpace(query.Get("descending")); rawDescending != "" {
		descending, err := strconv.ParseBool(rawDescending)
		if err != nil {
			return words.ListLearningItemsParams{}, errors.New("descending must be true or false")
		}
		params.Descending = descending
	}

	if rawCursor := strings.TrimSpace(query.Get("cursor")); rawCursor != "" {
		cursor, err := words.DecodeLearningItemsCursor(rawCursor)
		if err != nil {
			return words.ListLearningItemsParams{}, errors.New("invalid cursor")
		}
		params.Cursor = &cursor
	}

	params.Search = strings.TrimSpace(query.Get("q"))

	return params, nil
}

func (h *wordsHandler) writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, words.ErrSenseNotFound):
		writeError(w, http.StatusUnprocessableEntity, "word sense not found")
	case errors.Is(err, words.ErrTranslationUnavailable):
		writeError(w, http.StatusUnprocessableEntity, "localized translation unavailable for this word sense")
	case errors.Is(err, words.ErrForceAmbiguous):
		writeError(w, http.StatusBadRequest, "force requires a concrete part_of_speech or a word_id")
	case errors.Is(err, enrich.ErrNotConfigured), errors.Is(err, words.ErrNoSenses):
		writeError(w, http.StatusServiceUnavailable, "word enrichment is not available; configure ENRICH_BASE_URL or add the sense manually")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func userIDFromRequest(r *http.Request) string {
	if user, ok := userFromContext(r.Context()); ok {
		return user.ID
	}
	return ""
}

func (h *wordsHandler) getDueReviewItems(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	items, err := h.svc.GetDueReviewItems(r.Context(), userIDFromRequest(r), limit)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}

	if items == nil {
		items = []words.DueItem{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *wordsHandler) recordBatchReviewAttempts(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Attempts []words.ReviewAttemptParams `json:"attempts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Validate attempts
	for _, attempt := range req.Attempts {
		if strings.TrimSpace(attempt.UserWordSenseID) == "" {
			writeError(w, http.StatusBadRequest, "user_word_sense_id is required for all attempts")
			return
		}
		if strings.TrimSpace(attempt.ActivityType) == "" {
			writeError(w, http.StatusBadRequest, "activity_type is required for all attempts")
			return
		}
		if _, ok := validReviewActivityTypes[attempt.ActivityType]; !ok {
			writeError(w, http.StatusBadRequest, "invalid activity_type")
			return
		}
		if attempt.RatingScore < 0.0 || attempt.RatingScore > 3.0 {
			writeError(w, http.StatusBadRequest, "rating_score must be between 0.0 and 3.0")
			return
		}
	}

	result, err := h.svc.RecordBatchReviewAttempts(r.Context(), userIDFromRequest(r), req.Attempts)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *wordsHandler) optimizeWeights(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.OptimizeWeights(r.Context(), userIDFromRequest(r))
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, result)
}

func (h *wordsHandler) optimizationStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.svc.GetOptimizationStatus(r.Context(), userIDFromRequest(r))
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}
