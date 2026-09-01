package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"github.com/nacfson/central-auth/internal/config"
	"github.com/nacfson/central-auth/internal/db"
	httpapi "github.com/nacfson/central-auth/internal/httpapi"
	"github.com/nacfson/central-auth/internal/session"
)

func main() {
	ctx := context.Background()
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}
	if err := runMigrations(cfg); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	sessions := session.NewService(pool, cfg)
	router := httpapi.NewRouter(sessions, cfg)
	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("central auth listening", "addr", cfg.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

func runMigrations(cfg config.Config) error {
	migrationsPath := cfg.MigrationsPath
	if !filepath.IsAbs(migrationsPath) && !hasScheme(migrationsPath) {
		if wd, err := os.Getwd(); err == nil {
			migrationsPath = "file://" + filepath.Join(wd, "db", "migrations")
		}
	}
	m, err := migrate.New(migrationsPath, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}

func hasScheme(path string) bool {
	return len(path) > 7 && path[:7] == "file://"
}
