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
	DB                   *pgxpool.Pool
	Words                *words.Service
	Auth                 *auth.Service
	OAuthVerifiers       map[string]auth.OAuthVerifier
	AllowedOrigins       []string
	RequireEmailVerified bool
}

func NewRouter(deps Dependencies) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	if len(deps.AllowedOrigins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   deps.AllowedOrigins,
			AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodOptions},
			AllowedHeaders:   []string{"Content-Type", "Authorization"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	r.Get("/healthz", healthz)
	r.Get("/readyz", readyz(deps.DB))

	if deps.Auth != nil {
		ah := &authHandler{svc: deps.Auth, oauthVerifiers: deps.OAuthVerifiers}

		r.Route("/api/auth", func(authRouter chi.Router) {
			authRouter.With(authIPRateLimit(), authEmailRateLimit()).Post("/register", ah.register)
			authRouter.With(authIPRateLimit(), authEmailRateLimit()).Post("/login", ah.login)
			authRouter.With(authIPRateLimit()).Post("/oauth/{provider}", ah.oauthLogin)
			authRouter.With(authIPRateLimit(), authEmailRateLimit()).Post("/magic-link", ah.magicLink)
			authRouter.With(consumeIPRateLimit()).Get("/magic/consume", ah.magicConsume)
			authRouter.With(consumeIPRateLimit()).Post("/magic/exchange", ah.magicExchange)

			authRouter.Group(func(protected chi.Router) {
				protected.Use(authMiddleware(deps.Auth))
				protected.Get("/me", ah.me)
				protected.Post("/logout", ah.logout)
			})
		})
	}

	if deps.Words != nil {
		wh := &wordsHandler{svc: deps.Words}
		r.Route("/api", func(api chi.Router) {
			api.Group(func(protected chi.Router) {
				if deps.Auth != nil {
					protected.Use(authMiddleware(deps.Auth))
					protected.Use(requireVerified(deps.RequireEmailVerified))
				}
				protected.Post("/words/lookup", wh.lookup)
				protected.Get("/learning-items", wh.listLearningItems)
				protected.Post("/learning-items", wh.addLearningItem)
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
