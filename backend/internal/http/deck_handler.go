package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"project-pn/internal/words"
)

type deckHandler struct {
	svc *words.Service
}

type createDeckRequest struct {
	Name           string `json:"name"`
	TargetLanguage string `json:"target_language"`
}

type renameDeckRequest struct {
	Name string `json:"name"`
}

type moveItemsRequest struct {
	UserWordSenseIDs []string `json:"user_word_sense_ids"`
}

type decksResponse struct {
	Decks []words.Deck `json:"decks"`
}

func (h *deckHandler) listDecks(w http.ResponseWriter, r *http.Request) {
	langCode := strings.TrimSpace(r.URL.Query().Get("language_code"))
	decks, err := h.svc.ListDecks(r.Context(), userIDFromRequest(r), langCode)
	if err != nil {
		h.writeDeckError(w, err)
		return
	}
	if decks == nil {
		decks = []words.Deck{}
	}
	writeJSON(w, http.StatusOK, decksResponse{Decks: decks})
}

func (h *deckHandler) createDeck(w http.ResponseWriter, r *http.Request) {
	var req createDeckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if strings.TrimSpace(req.TargetLanguage) == "" {
		writeError(w, http.StatusBadRequest, "target_language is required")
		return
	}

	deck, err := h.svc.CreateDeck(r.Context(), userIDFromRequest(r), req.Name, req.TargetLanguage)
	if err != nil {
		h.writeDeckError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, deck)
}

func (h *deckHandler) renameDeck(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "deck_id")
	if strings.TrimSpace(deckID) == "" {
		writeError(w, http.StatusBadRequest, "deck_id is required")
		return
	}

	var req renameDeckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	if err := h.svc.RenameDeck(r.Context(), userIDFromRequest(r), deckID, req.Name); err != nil {
		h.writeDeckError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *deckHandler) deleteDeck(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "deck_id")
	if strings.TrimSpace(deckID) == "" {
		writeError(w, http.StatusBadRequest, "deck_id is required")
		return
	}

	if err := h.svc.DeleteDeck(r.Context(), userIDFromRequest(r), deckID); err != nil {
		h.writeDeckError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *deckHandler) moveItems(w http.ResponseWriter, r *http.Request) {
	deckID := chi.URLParam(r, "deck_id")
	if strings.TrimSpace(deckID) == "" {
		writeError(w, http.StatusBadRequest, "deck_id is required")
		return
	}

	var req moveItemsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	for _, id := range req.UserWordSenseIDs {
		if strings.TrimSpace(id) == "" {
			writeError(w, http.StatusBadRequest, "user_word_sense_ids must not contain empty values")
			return
		}
	}

	if err := h.svc.MoveItemsToDeck(r.Context(), userIDFromRequest(r), deckID, req.UserWordSenseIDs); err != nil {
		h.writeDeckError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *deckHandler) writeDeckError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, words.ErrDeckNotFound):
		writeError(w, http.StatusNotFound, "deck not found")
	case errors.Is(err, words.ErrDeckNotOwned), errors.Is(err, words.ErrDeckLanguageMismatch):
		writeError(w, http.StatusForbidden, "deck not available for this user or language")
	case errors.Is(err, words.ErrCannotDeleteDefaultDeck):
		writeError(w, http.StatusConflict, "cannot delete default deck")
	case errors.Is(err, words.ErrInvalidDeckName):
		writeError(w, http.StatusBadRequest, "invalid deck name")
	case errors.Is(err, words.ErrDeckNameExists):
		writeError(w, http.StatusConflict, "deck name already exists")
	case errors.Is(err, words.ErrInvalidTargetLanguagePair), errors.Is(err, words.ErrInvalidTargetLang):
		writeError(w, http.StatusBadRequest, "invalid target language")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}
