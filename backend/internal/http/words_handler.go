package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"project-pn/internal/enrich"
	"project-pn/internal/words"
)

type wordsHandler struct {
	svc *words.Service
}

type lookupRequest struct {
	Text                   string  `json:"text"`
	LanguageCode           string  `json:"language_code"`
	DefinitionLanguageCode string  `json:"definition_language_code"`
	PartOfSpeech           string  `json:"part_of_speech"`
	WordID                 *string `json:"word_id"`
	Force                  bool    `json:"force"`
}

type addLearningItemRequest struct {
	WordSenseID string `json:"word_sense_id"`
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

	// "Any" (or empty) is a lookup filter only and never a persisted POS.
	var pos *string
	if p := strings.TrimSpace(req.PartOfSpeech); p != "" && !strings.EqualFold(p, "any") {
		pos = &p
	}

	wordID := req.WordID
	if wordID != nil && strings.TrimSpace(*wordID) == "" {
		wordID = nil
	}

	var (
		result words.LookupResult
		err    error
	)
	if req.Force {
		// Guard: force=true with POS=Any and no word_id is ambiguous.
		if wordID == nil && pos == nil {
			writeError(w, http.StatusBadRequest, "force requires a concrete part_of_speech or a word_id")
			return
		}
		result, err = h.svc.ForceGenerate(r.Context(), wordID, req.Text, req.LanguageCode, req.DefinitionLanguageCode, pos)
	} else {
		result, err = h.svc.Lookup(r.Context(), req.Text, req.LanguageCode, req.DefinitionLanguageCode, pos)
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

	item, err := h.svc.AddLearningItem(r.Context(), userIDFromRequest(r), req.WordSenseID)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (h *wordsHandler) writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, words.ErrSenseNotFound):
		writeError(w, http.StatusUnprocessableEntity, "word sense not found")
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
