package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"project-pn/internal/admin"
	"project-pn/internal/config"
	"project-pn/internal/db"
	"project-pn/internal/enrich"
	"project-pn/internal/learninglog"
	"project-pn/internal/words"
)

func main() {
	var (
		limit           int
		wordID          string
		dryRun          bool
		continueOnError bool
	)
	flag.IntVar(&limit, "limit", 0, "max words to process (0 = all)")
	flag.StringVar(&wordID, "word-id", "", "optional single word UUID")
	flag.BoolVar(&dryRun, "dry-run", false, "list target words without retranslating")
	flag.BoolVar(&continueOnError, "continue-on-error", false, "continue after per-word errors")
	flag.Parse()

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	adminLogger, err := admin.NewLogger(cfg.AdminLogPath)
	if err != nil {
		adminLogger = admin.NoopLogger{}
	}
	defer adminLogger.Close()

	primary := enrich.NewOpenAI(cfg.EnrichPrimaryBaseURL, cfg.EnrichPrimaryAPIKey, cfg.EnrichPrimaryModel)
	var fallback enrich.Enricher
	if cfg.EnrichFallbackBaseURL != "" {
		fallback = enrich.NewOpenAI(cfg.EnrichFallbackBaseURL, cfg.EnrichFallbackAPIKey, cfg.EnrichFallbackModel)
	}
	enricher := enrich.NewFallback(primary, fallback, slog.Default())
	learningLogger, err := learninglog.NewLogger(cfg.LearningLogDir)
	if err != nil {
		learningLogger = learninglog.NoopLogger{}
	}
	defer learningLogger.Close()
	svc := words.New(pool, enricher, adminLogger, learningLogger, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	ids, err := listWordIDs(ctx, pool, strings.TrimSpace(wordID), limit)
	if err != nil {
		slog.Error("list words failed", "error", err)
		os.Exit(1)
	}
	slog.Info("retranslate-senses starting", "count", len(ids), "dry_run", dryRun)

	ok, failed := 0, 0
	for i, id := range ids {
		if dryRun {
			slog.Info("dry-run word", "index", i+1, "word_id", id)
			ok++
			continue
		}
		if err := svc.RetranslateWord(ctx, id); err != nil {
			failed++
			slog.Error("retranslate failed", "word_id", id, "error", err)
			if !continueOnError {
				os.Exit(1)
			}
			continue
		}
		ok++
		if (i+1)%10 == 0 || i+1 == len(ids) {
			slog.Info("retranslate progress", "done", i+1, "total", len(ids), "ok", ok, "failed", failed)
		}
	}
	slog.Info("retranslate-senses finished", "ok", ok, "failed", failed)
	if failed > 0 {
		os.Exit(1)
	}
}

func listWordIDs(ctx context.Context, pool *pgxpool.Pool, wordID string, limit int) ([]string, error) {
	if wordID != "" {
		return []string{wordID}, nil
	}

	var (
		rows pgx.Rows
		err  error
	)
	if limit > 0 {
		rows, err = pool.Query(ctx, `select id::text from words order by id limit $1`, limit)
	} else {
		rows, err = pool.Query(ctx, `select id::text from words order by id`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
