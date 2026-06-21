package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"project-pn/internal/words"
)

type importHandler struct {
	svc *words.Service
}

func (h *importHandler) previewAnkiImport(w http.ResponseWriter, r *http.Request) {
	var reader io.Reader
	if file, _, err := r.FormFile("file"); err == nil {
		defer file.Close()
		reader = file
	} else if text := r.FormValue("text"); text != "" {
		reader = strings.NewReader(text)
	} else {
		writeError(w, http.StatusBadRequest, "file or text is required")
		return
	}

	cards, err := words.ParseAnkiCSV(reader)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req := words.AnkiImportRequest{
		Cards:                  cards,
		LanguageCode:           r.FormValue("language_code"),
		DefinitionLanguageCode: r.FormValue("definition_language_code"),
	}

	preview, err := h.svc.PreviewAnkiImport(r.Context(), userIDFromRequest(r), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "preview failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"cards": cards,
		"items": preview.Items,
	})
}

func (h *importHandler) importAnki(w http.ResponseWriter, r *http.Request) {
	req, err := parseAnkiImportRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if len(req.Cards) == 0 {
		writeError(w, http.StatusBadRequest, "cards is required")
		return
	}

	result, err := h.svc.ImportAnkiCards(r.Context(), userIDFromRequest(r), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "import failed")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// parseAnkiImportRequest decodes and normalizes an Anki import JSON request.
func parseAnkiImportRequest(r *http.Request) (words.AnkiImportRequest, error) {
	var req words.AnkiImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return req, err
	}
	for i := range req.Cards {
		req.Cards[i].Front = strings.TrimSpace(req.Cards[i].Front)
		req.Cards[i].Back = strings.TrimSpace(req.Cards[i].Back)
	}
	return req, nil
}
