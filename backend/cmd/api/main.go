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
	"project-pn/internal/enrich"
	httpapi "project-pn/internal/http"
	"project-pn/internal/notify"
	"project-pn/internal/words"
)

func main() {
	ctx := context.Background()

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	enricher := enrich.NewOpenAI(cfg.EnrichBaseURL, cfg.EnrichAPIKey, cfg.EnrichModel)
	authService := auth.New(pool, auth.Options{
		DefaultDefinitionLang:  cfg.DefaultDefinitionLang,
		DefaultTargetLang:      cfg.DefaultTargetLang,
		DefaultUILang:          cfg.UILang,
		AllowedDefinitionLangs: cfg.AllowedDefinitionLangs,
		AllowedTargetLangs:     cfg.AllowedTargetLangs,
		AllowedUILangs:         cfg.AllowedUILangs,
		ForceDefinitionLang:    cfg.ForceDefinitionLang,
		ForceTargetLang:        cfg.ForceTargetLang,
		ForceUILang:            cfg.ForceUILang,
	})
	var centralAuth *auth.CentralClient
	centralAuthURL := cfg.CentralAuthInternalURL
	if centralAuthURL == "" {
		centralAuthURL = cfg.CentralAuthURL
	}
	if centralAuthURL == "" {
		slog.Error("CENTRAL_AUTH_URL or CENTRAL_AUTH_INTERNAL_URL is required")
		os.Exit(1)
	}
	centralAuth = auth.NewCentralClient(centralAuthURL, nil)
	slog.Info("using central auth URL", "url", centralAuthURL, "public_url", cfg.CentralAuthURL)
	wordsService := words.New(pool, enricher, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	server := &http.Server{
		Addr: cfg.AppAddr,
		Handler: httpapi.NewRouter(httpapi.Dependencies{
			DB:             pool,
			Words:          wordsService,
			Auth:           authService,
			CentralAuth:    centralAuth,
			AllowedOrigins: cfg.AllowedOrigins,
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	workerCtx, stopWorker := context.WithCancel(ctx)
	defer stopWorker()
	slog.Info("auth configuration loaded", "central_auth_url", cfg.CentralAuthURL)

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
