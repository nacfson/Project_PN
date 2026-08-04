package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"project-pn/internal/admin"
	"project-pn/internal/curriculum"
)

type curriculumHandler struct {
	svc    *curriculum.Service
	logger admin.Logger
}

func (h *curriculumHandler) logf(category, format string, args ...interface{}) {
	if h.logger != nil {
		h.logger.Logf(category, format, args...)
	}
}

type packsResponse struct {
	Packs []curriculum.Pack `json:"packs"`
}

func (h *curriculumHandler) listPacks(w http.ResponseWriter, r *http.Request) {
	packs, err := h.svc.ListPacks(r.Context(), userIDFromRequest(r))
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, packsResponse{Packs: packs})
}

func (h *curriculumHandler) getPack(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	limit := 50
	if raw := strings.TrimSpace(r.URL.Query().Get("preview_limit")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil {
			limit = n
		}
	}
	detail, err := h.svc.GetPack(r.Context(), userIDFromRequest(r), slug, limit)
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *curriculumHandler) enroll(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	result, err := h.svc.Enroll(r.Context(), userIDFromRequest(r), slug)
	if err != nil {
		h.writeError(w, err)
		return
	}
	status := http.StatusCreated
	if result.AlreadyEnrolled {
		status = http.StatusOK
	}
	h.logf("CURRICULUM_ENROLL", "%s enrolled in %s (added=%d skipped=%d)",
		userIdentifierFromRequest(r), result.Slug, result.AddedCount, result.SkippedCount)
	writeJSON(w, status, result)
}

func (h *curriculumHandler) writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, curriculum.ErrPackNotFound):
		writeError(w, http.StatusNotFound, "curriculum pack not found")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}
