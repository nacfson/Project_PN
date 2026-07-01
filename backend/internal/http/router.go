package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/auth"
	"project-pn/internal/words"
)

type Dependencies struct {
	DB             *pgxpool.Pool
	Words          *words.Service
	Auth           *auth.Service
	CentralAuth    *auth.CentralClient
	AllowedOrigins []string
}

func keyByRealIP(r *http.Request) (string, error) {
	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.RemoteAddr
	}
	return ip, nil
}

func NewRouter(deps Dependencies) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	if len(deps.AllowedOrigins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   deps.AllowedOrigins,
			AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
			AllowedHeaders:   []string{"Content-Type", "Authorization"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	r.Get("/healthz", healthz)
	r.Get("/readyz", readyz(deps.DB))

	var authMW func(http.Handler) http.Handler
	if deps.Auth != nil {
		authMW = authMiddleware(deps.Auth, deps.CentralAuth)
		ah := &authHandler{svc: deps.Auth}

		r.Route("/api/auth", func(authRouter chi.Router) {
			authRouter.Get("/language-options", ah.languageOptions)

			authRouter.Group(func(protected chi.Router) {
				protected.Use(authMW)
				protected.Get("/me", ah.me)
				protected.Post("/logout", centralLogout(deps.CentralAuth))
			})
		})

		uh := &userHandler{svc: deps.Auth}
		r.Route("/api/user", func(userRouter chi.Router) {
			userRouter.Use(authMW)
			userRouter.Get("/languages", uh.listLanguages)
			userRouter.Post("/languages", uh.addLanguage)
			userRouter.Patch("/languages/{target_language}", uh.updateDisplayLanguage)
			userRouter.Patch("/languages/{target_language}/active", uh.setActiveLanguage)
			userRouter.Delete("/languages/{target_language}", uh.removeLanguage)
			userRouter.Get("/ui-language", uh.getUILanguage)
			userRouter.Put("/ui-language", uh.setUILanguage)
		})
	}

	if deps.Words != nil {
		wh := &wordsHandler{svc: deps.Words}
		r.Route("/api", func(api chi.Router) {
			api.Group(func(protected chi.Router) {
				if deps.Auth != nil {
					protected.Use(authMW)
					protected.Use(requireVerified())
				}
				protected.Post("/words/lookup", wh.lookup)
				protected.Get("/learning-items", wh.listLearningItems)
				protected.Post("/learning-items", wh.addLearningItem)
				protected.Get("/reviews/due", wh.getDueReviewItems)
				protected.Post("/reviews/batch", wh.recordBatchReviewAttempts)
				protected.Post("/reviews/optimize-weights", wh.optimizeWeights)
				protected.Get("/reviews/optimization-status", wh.optimizationStatus)

				rsh := &reviewSettingsHandler{svc: deps.Words}
				protected.Get("/reviews/settings", rsh.getReviewSettings)
				protected.Patch("/reviews/settings", rsh.patchReviewSettings)

				sth := &streakSettingsHandler{svc: deps.Words}
				protected.Get("/streaks/settings", sth.getStreakSettings)
				protected.Patch("/streaks/settings", sth.patchStreakSettings)

				sh := &statsHandler{svc: deps.Words}
				protected.Get("/stats/summary", sh.getStatsSummary)

				dh := &deckHandler{svc: deps.Words}
				protected.Get("/decks", dh.listDecks)
				protected.Post("/decks", dh.createDeck)
				protected.Patch("/decks/{deck_id}", dh.renameDeck)
				protected.Delete("/decks/{deck_id}", dh.deleteDeck)
				protected.Post("/decks/{deck_id}/move-items", dh.moveItems)

				nh := &notificationsHandler{svc: deps.Words}
				protected.Post("/notifications/register", nh.registerPushToken)

				ch := &contentHandler{svc: deps.Words}
				protected.Get("/content/word-of-the-day", ch.getWordOfTheDay)
				protected.Get("/content/challenges", ch.listChallenges)

				ih := &importHandler{svc: deps.Words}
				protected.Post("/import/anki/preview", ih.previewAnkiImport)
				protected.Post("/import/anki", ih.importAnki)
			})
		})
	}

	return r
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func readyz(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if pool == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		if err := pool.Ping(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
