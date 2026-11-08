package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"project-pn/internal/analytics"
)

const maxAnalyticsBatchBytes = 256 * 1024
const maxAnalyticsBatchEvents = 100

type analyticsHandler struct {
	logger analytics.Logger
}

func (h analyticsHandler) collect(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAnalyticsBatchBytes)
	var batch analytics.Batch
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&batch); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeCodedError(w, http.StatusRequestEntityTooLarge, "ANL-413", "analytics batch is too large", false)
			return
		}
		writeCodedError(w, http.StatusBadRequest, "ANL-301", "invalid analytics batch", false)
		return
	}
	if len(batch.Events) == 0 || len(batch.Events) > maxAnalyticsBatchEvents {
		writeCodedError(w, http.StatusBadRequest, "ANL-302", "analytics batch must contain 1 to 100 events", false)
		return
	}
	for _, event := range batch.Events {
		if err := analytics.Validate(event); err != nil {
			writeCodedError(w, http.StatusBadRequest, "ANL-303", err.Error(), false)
			return
		}
	}

	trustedUserID := userIDFromRequest(r)
	now := time.Now().UTC()
	for _, event := range batch.Events {
		event.AuthenticatedUserID = trustedUserID
		h.logger.Emit(analytics.NewRecord(event, now))
	}
	writeJSON(w, http.StatusAccepted, map[string]int{"accepted": len(batch.Events)})
}
