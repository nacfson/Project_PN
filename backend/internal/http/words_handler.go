package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"project-pn/internal/admin"
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
	svc    *words.Service
	logger admin.Logger
}

func (h *wordsHandler) logf(category, format string, args ...interface{}) {
	if h.logger != nil {
		h.logger.Logf(category, format, args...)
	}
}

type lookupRequest struct {
	Text                   string  `json:"text"`
	LanguageCode           string  `json:"language_code"`
	DisplayLanguageCode    string  `json:"display_language_code"`
	DefinitionLanguageCode string  `json:"definition_language_code"` // deprecated: use display_language_code
	PartOfSpeech           string  `json:"part_of_speech"`
	WordID                 *string `json:"word_id"`
	Force                  bool    `json:"force"`
	SourceContext          string  `json:"source_context"`
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
	DeckID              string `json:"deck_id"`
	SourceContext       string `json:"source_context"`
	PersonalNote        string `json:"personal_note"`
}

func (h *wordsHandler) lookup(w http.ResponseWriter, r *http.Request) {
	var req lookupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeCodedError(w, http.StatusBadRequest, "ADD-301", "invalid JSON body", false)
		return
	}
	if strings.TrimSpace(req.Text) == "" && req.WordID == nil {
		writeCodedError(w, http.StatusBadRequest, "ADD-301", "text is required", false)
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

	userID := userIDFromRequest(r)
	var (
		result words.LookupResult
		err    error
	)
	if req.Force {
		if wordID == nil && pos == nil {
			writeCodedError(w, http.StatusBadRequest, "ADD-301", "force requires a concrete part_of_speech or a word_id", false)
			return
		}
		result, err = h.svc.ForceGenerate(r.Context(), userID, wordID, req.Text, req.LanguageCode, displayLang, req.SourceContext, pos)
	} else {
		result, err = h.svc.Lookup(r.Context(), userID, req.Text, req.LanguageCode, displayLang, req.SourceContext, pos)
	}
	if err != nil {
		h.writeServiceError(w, r, err)
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
		writeCodedError(w, http.StatusBadRequest, "ADD-301", "invalid JSON body", false)
		return
	}
	if strings.TrimSpace(req.WordSenseID) == "" {
		writeCodedError(w, http.StatusBadRequest, "ADD-301", "word_sense_id is required", false)
		return
	}

	item, err := h.svc.AddLearningItem(r.Context(), userIDFromRequest(r), req.WordSenseID, req.DisplayLanguageCode, req.DeckID, req.SourceContext, req.PersonalNote)
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}
	h.logf("ADD_ITEM", "%s added learning item word_sense_id=%s", userIdentifierFromRequest(r), item.WordSenseID)
	writeJSON(w, http.StatusCreated, item)
}

type changeLearningItemSenseRequest struct {
	WordSenseID         string  `json:"word_sense_id"`
	DisplayLanguageCode string  `json:"display_language_code"`
	PersonalNote        *string `json:"personal_note"`
}

func (h *wordsHandler) changeLearningItemSense(w http.ResponseWriter, r *http.Request) {
	itemID := strings.TrimSpace(chi.URLParam(r, "id"))
	if itemID == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}
	var req changeLearningItemSenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	userID := userIDFromRequest(r)
	hasSense := strings.TrimSpace(req.WordSenseID) != ""
	hasNote := req.PersonalNote != nil
	if !hasSense && !hasNote {
		writeError(w, http.StatusBadRequest, "word_sense_id or personal_note is required")
		return
	}

	var item words.LearningItem
	var err error
	if hasSense {
		item, err = h.svc.ChangeLearningItemSense(r.Context(), userID, itemID, req.WordSenseID, req.DisplayLanguageCode, req.PersonalNote)
		if err != nil {
			h.writeServiceError(w, r, err)
			return
		}
	} else if hasNote {
		item, err = h.svc.SetPersonalNote(r.Context(), userID, itemID, *req.PersonalNote)
		if err != nil {
			h.writeServiceError(w, r, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *wordsHandler) archiveLearningItem(w http.ResponseWriter, r *http.Request) {
	itemID := strings.TrimSpace(chi.URLParam(r, "id"))
	if itemID == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}
	n, err := h.svc.ArchiveLearningItems(r.Context(), userIDFromRequest(r), []string{itemID})
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}
	if n == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *wordsHandler) archiveLearningItems(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ItemIDs []string `json:"item_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(req.ItemIDs) == 0 {
		writeError(w, http.StatusBadRequest, "item_ids is required")
		return
	}
	n, err := h.svc.ArchiveLearningItems(r.Context(), userIDFromRequest(r), req.ItemIDs)
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"archived": n})
}

func (h *wordsHandler) listLearningItems(w http.ResponseWriter, r *http.Request) {
	params, err := parseListLearningItemsParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	page, err := h.svc.ListLearningItems(r.Context(), userIDFromRequest(r), params)
	if err != nil {
		h.writeServiceError(w, r, err)
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
	params.LanguageCode = strings.TrimSpace(query.Get("language_code"))
	params.DeckID = strings.TrimSpace(query.Get("deck_id"))
	params.Origin = strings.TrimSpace(strings.ToLower(query.Get("origin")))

	return params, nil
}

func (h *wordsHandler) writeServiceError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, words.ErrSenseNotFound):
		writeCodedError(w, http.StatusUnprocessableEntity, "ADD-302", "word sense not found", false)
	case errors.Is(err, words.ErrLearningItemNotFound):
		writeCodedError(w, http.StatusNotFound, "ADD-302", "learning item not found", false)
	case errors.Is(err, words.ErrReviewItemUnavailable):
		writeCodedError(w, http.StatusConflict, "REV-409", "review item is archived or suspended", false)
	case errors.Is(err, words.ErrSenseConflict):
		writeCodedError(w, http.StatusConflict, "ADD-308", "sense_already_in_learning_set", false)
	case errors.Is(err, words.ErrSenseWrongWord):
		writeCodedError(w, http.StatusUnprocessableEntity, "ADD-302", "word sense does not belong to the same word", false)
	case errors.Is(err, words.ErrTranslationUnavailable):
		writeCodedError(w, http.StatusUnprocessableEntity, "ADD-304", "localized translation unavailable for this word sense", false)
	case errors.Is(err, words.ErrForceAmbiguous):
		writeCodedError(w, http.StatusBadRequest, "ADD-301", "force requires a concrete part_of_speech or a word_id", false)
	case errors.Is(err, words.ErrDeckNotFound):
		writeCodedError(w, http.StatusNotFound, "ADD-305", "deck not found", false)
	case errors.Is(err, words.ErrDeckNotOwned), errors.Is(err, words.ErrDeckLanguageMismatch):
		writeCodedError(w, http.StatusForbidden, "ADD-306", "deck not available for this user or language", false)
	case errors.Is(err, words.ErrInvalidDeckOrigin):
		writeCodedError(w, http.StatusBadRequest, "ADD-301", "origin must be private", false)
	case errors.Is(err, words.ErrInvalidDeckName):
		writeCodedError(w, http.StatusBadRequest, "ADD-301", "invalid deck name", false)
	case errors.Is(err, words.ErrDeckNameExists):
		writeCodedError(w, http.StatusConflict, "ADD-301", "deck name already exists", false)
	case errors.Is(err, words.ErrInvalidTargetLanguagePair), errors.Is(err, words.ErrInvalidTargetLang):
		writeCodedError(w, http.StatusBadRequest, "ADD-307", "invalid target language", false)
	case errors.Is(err, enrich.ErrUnsupportedLanguage):
		writeCodedError(w, http.StatusServiceUnavailable, "ADD-401", "multilingual enrichment provider required for this target language", false)
	case errors.Is(err, enrich.ErrNotConfigured):
		writeCodedError(w, http.StatusServiceUnavailable, "ADD-402", "word enrichment is not available; set ENRICH_PRIMARY_BASE_URL or add the sense manually", false)
	case errors.Is(err, enrich.ErrNoAdditionalSenses):
		writeCodedError(w, http.StatusUnprocessableEntity, "ADD-303", "no_additional_senses", false)
	case errors.Is(err, enrich.ErrUnavailable):
		writeCodedError(w, http.StatusServiceUnavailable, "ADD-403", "word enrichment provider unreachable or rejected the request; check ENRICH_PRIMARY_* settings", true)
	case errors.Is(err, enrich.ErrInvalidOutput), errors.Is(err, words.ErrNoSenses):
		writeCodedError(w, http.StatusServiceUnavailable, "ADD-404", "word enrichment failed to produce usable output", true)
	case errors.Is(err, words.ErrNoAdditionalSense):
		writeCodedError(w, http.StatusServiceUnavailable, "ADD-303", "no additional distinct sense", false)
	default:
		writeInternalError(w, r, err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeCodedError(w http.ResponseWriter, status int, code, message string, retryable bool) {
	writeJSON(w, status, map[string]any{
		"error":     message,
		"code":      code,
		"retryable": retryable,
	})
}

func logHandlerError(r *http.Request, err error) {
	if r == nil {
		slog.Error("handler error", "error", err)
		return
	}
	slog.Error("handler error",
		"error", err,
		"method", r.Method,
		"path", r.URL.Path,
		"request_id", middleware.GetReqID(r.Context()),
	)
}

func writeInternalError(w http.ResponseWriter, r *http.Request, err error) {
	logHandlerError(r, err)
	writeCodedError(w, http.StatusInternalServerError, "ADD-599", "internal error", true)
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

	langCode := strings.TrimSpace(r.URL.Query().Get("language_code"))
	deckID := strings.TrimSpace(r.URL.Query().Get("deck_id"))
	origin := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("origin")))
	items, err := h.svc.GetDueReviewItems(r.Context(), userIDFromRequest(r), langCode, deckID, origin, limit)
	if err != nil {
		h.writeServiceError(w, r, err)
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
		h.writeServiceError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *wordsHandler) optimizeWeights(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.OptimizeWeights(r.Context(), userIDFromRequest(r))
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusAccepted, result)
}

func (h *wordsHandler) optimizationStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.svc.GetOptimizationStatus(r.Context(), userIDFromRequest(r))
	if err != nil {
		h.writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}
