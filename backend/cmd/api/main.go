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

	"project-pn/internal/admin"
	"project-pn/internal/analytics"
	"project-pn/internal/auth"
	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/enrich"
	httpapi "project-pn/internal/http"
	"project-pn/internal/learninglog"
	"project-pn/internal/logx"
	"project-pn/internal/migrations"
	"project-pn/internal/notify"
	"project-pn/internal/words"
)

var version = "v0.0.0"

func main() {
	slog.SetDefault(logx.New(os.Stderr, "pn-api", version))
	ctx := context.Background()

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		slog.Error("DATABASE_URL is required (set DATABASE_URL or DB_HOST)")
		os.Exit(1)
	}

	if err := migrations.Up(cfg.MigrationsPath, cfg.DatabaseURL); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}

	adminLogger := admin.NewLogger()
	defer adminLogger.Close()
	metricsCollector := admin.NewMetricsCollector()

	learningLogger, err := learninglog.NewLogger(cfg.LearningLogDir)
	if err != nil {
		slog.Warn("learning logger disabled", "error", err)
	}
	defer learningLogger.Close()
	var analyticsLogger analytics.Logger = analytics.NoopLogger{}
	if cfg.AnalyticsEnabled {
		analyticsLogger = analytics.NewJSONLogger(os.Stdout)
	}

	metricsCtx, stopMetrics := context.WithCancel(ctx)
	defer stopMetrics()
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-metricsCtx.Done():
				return
			case <-ticker.C:
				metricsCollector.Flush(adminLogger)
			}
		}
	}()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	primaryEnricher := enrich.NewWiktAPI(cfg.OriginWiktAPIBaseURL)
	var enricher enrich.Enricher = primaryEnricher
	if cfg.EnrichPrimaryBaseURL != "" {
		llm := enrich.NewOpenAI(cfg.EnrichPrimaryBaseURL, cfg.EnrichPrimaryModel)
		enricher = enrich.NewFallback(primaryEnricher, llm, slog.Default())
		slog.Info("gloss origin configured",
			"primary", "wiktapi",
			"fallback", "llm",
			"wiktapi_url", cfg.OriginWiktAPIBaseURL,
			"llm_model", cfg.EnrichPrimaryModel,
			"llm_url", cfg.EnrichPrimaryBaseURL,
		)
	} else {
		slog.Info("gloss origin configured",
			"primary", "wiktapi",
			"wiktapi_url", cfg.OriginWiktAPIBaseURL,
		)
	}
	jwtVerifier := auth.NewJWTVerifier(auth.JWTVerifierConfig{
		Issuer:      cfg.AuthJWTIssuer,
		Audience:    cfg.AuthJWTAudience,
		JWKSURL:     cfg.AuthJWTJWKSURL,
		AllowedAlgs: cfg.AuthJWTAllowedAlgs,
		ClockSkew:   cfg.AuthJWTClockSkew,
	})
	slog.Info("gateway jwt verifier configured",
		"issuer", cfg.AuthJWTIssuer,
		"audience", cfg.AuthJWTAudience,
		"jwks_url", cfg.AuthJWTJWKSURL,
		"dev_mode", cfg.AuthDevBypass,
	)

	var centralAuth *auth.CentralClient
	centralAuthURL := cfg.CentralAuthURL
	if centralAuthURL == "" {
		centralAuthURL = cfg.CentralAuthInternalURL
	}
	if centralAuthURL != "" {
		centralAuth = auth.NewCentralClientWithInternalAuth(
			centralAuthURL,
			cfg.CentralAuthInternalURL,
			cfg.AuthSessionInternalToken,
			nil,
		)
	}

	var gatewayClient *auth.GatewayClient
	if cfg.GatewayAuthURL != "" {
		gatewayClient = auth.NewGatewayClient(cfg.GatewayAuthURL, cfg.SignIn, nil)
	}

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
	wordsService := words.New(pool, enricher, adminLogger, learningLogger, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	server := &http.Server{
		Addr: cfg.AppAddr,
		Handler: httpapi.NewRouter(httpapi.Dependencies{
			DB:               pool,
			Words:            wordsService,
			Auth:             authService,
			JWTVerifier:      jwtVerifier,
			AuthDevBypass:    cfg.AuthDevBypass,
			CentralAuth:      centralAuth,
			Gateway:          gatewayClient,
			PublicAppURL:     cfg.PublicAppURL,
			PublicAuthOrigin: cfg.CentralAuthURL,
			AllowedOrigins:   cfg.AllowedOrigins,
			AdminLogger:      adminLogger,
			MetricsCollector: metricsCollector,
			AnalyticsEnabled: cfg.AnalyticsEnabled,
			AnalyticsLogger:  analyticsLogger,
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	workerCtx, stopWorker := context.WithCancel(ctx)
	defer stopWorker()
	slog.Info("auth configuration loaded", "jwt_issuer", cfg.AuthJWTIssuer)

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
