package httpapi

import (
	"net/http"

	"project-pn/internal/words"
)

type statsHandler struct {
	svc *words.Service
}

func (h *statsHandler) getStatsSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.svc.GetStatsSummary(r.Context(), userIDFromRequest(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if summary.StageCounts == nil {
		summary.StageCounts = map[string]int{}
	}
	if summary.Forecast == nil {
		summary.Forecast = []words.StatsForecastDay{}
	}

	writeJSON(w, http.StatusOK, summary)
}
