package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"project-pn/internal/auth"
	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/email"
	"project-pn/internal/enrich"
	httpapi "project-pn/internal/http"
	"project-pn/internal/notify"
	"project-pn/internal/oauth"
	"project-pn/internal/words"
)

func main() {
	ctx := context.Background()

	cfg := config.Load()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	enricher := enrich.NewOpenAI(cfg.EnrichBaseURL, cfg.EnrichAPIKey, cfg.EnrichModel)
	mailer := email.NewProvider(cfg.EmailProvider, cfg.ResendAPIKey, cfg.EmailFrom)
	authService := auth.New(pool, mailer, auth.Options{
		SessionTTL:             cfg.SessionTTL,
		MagicLinkTTL:           cfg.MagicLinkTTL,
		ExchangeCodeTTL:        cfg.ExchangeCodeTTL,
		DefaultDefinitionLang:  cfg.DefaultDefinitionLang,
		DefaultTargetLang:      cfg.DefaultTargetLang,
		AllowedDefinitionLangs: cfg.AllowedDefinitionLangs,
		AllowedTargetLangs:     cfg.AllowedTargetLangs,
		ForceDefinitionLang:    cfg.ForceDefinitionLang,
		ForceTargetLang:        cfg.ForceTargetLang,
		AppPublicURL:           cfg.AppPublicURL,
	})
	wordsService := words.New(pool, enricher, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	oauthVerifiers := map[string]auth.OAuthVerifier{}
	if len(cfg.GoogleClientIDs) > 0 {
		oauthVerifiers["google"] = oauth.NewGoogleVerifier(cfg.GoogleClientIDs)
	}

	server := &http.Server{
		Addr: cfg.AppAddr,
		Handler: httpapi.NewRouter(httpapi.Dependencies{
			DB:                   pool,
			Words:                wordsService,
			Auth:                 authService,
			OAuthVerifiers:       oauthVerifiers,
			AllowedOrigins:       cfg.AllowedOrigins,
			RequireEmailVerified: cfg.RequireEmailVerified,
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	workerCtx, stopWorker := context.WithCancel(ctx)
	defer stopWorker()
	if cfg.NotificationWorkerEnabled {
		worker := &notify.Worker{
			Words:    wordsService,
			Sender:   &notify.ExpoSender{AccessToken: cfg.ExpoAccessToken},
			Interval: cfg.NotificationWorkerInterval,
		}
		go worker.Run(workerCtx)
		slog.Info("notification worker started", "interval", cfg.NotificationWorkerInterval)
	}

	errs := make(chan error, 1)
	go func() {
		slog.Info("api server listening", "addr", cfg.AppAddr)
		errs <- server.ListenAndServe()
	}()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errs:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("api server failed", "error", err)
			os.Exit(1)
		}
	case <-shutdown:
		stopWorker()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("api server shutdown failed", "error", err)
			os.Exit(1)
		}
	}
}
