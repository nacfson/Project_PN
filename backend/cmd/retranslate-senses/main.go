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
		userID          string
		email           string
		dryRun          bool
		continueOnError bool
	)
	flag.IntVar(&limit, "limit", 0, "max words to process (0 = all)")
	flag.StringVar(&wordID, "word-id", "", "optional single word UUID")
	flag.StringVar(&userID, "user-id", "", "only words in this user's active learning set")
	flag.StringVar(&email, "email", "", "resolve -user-id from users.email (e.g. dev@project-pn.local)")
	flag.BoolVar(&dryRun, "dry-run", false, "preview AutoMatch mappings without writing")
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

	adminLogger := admin.NewLogger()
	defer adminLogger.Close()

	// Default origin: free WiktApi. Optional Gemini/OpenAI only as fallback.
	primary := enrich.NewWiktAPI(cfg.OriginWiktAPIBaseURL)
	var enricher enrich.Enricher = primary
	if cfg.EnrichPrimaryBaseURL != "" {
		llm := enrich.NewOpenAI(cfg.EnrichPrimaryBaseURL, cfg.EnrichPrimaryModel)
		enricher = enrich.NewFallback(primary, llm, slog.New(slog.NewTextHandler(os.Stdout, nil)))
	}
	slog.Info("retranslate enricher", "primary", "wiktapi", "base", cfg.OriginWiktAPIBaseURL)

	learningLogger, err := learninglog.NewLogger(cfg.LearningLogDir)
	if err != nil {
		learningLogger = learninglog.NoopLogger{}
	}
	defer learningLogger.Close()
	svc := words.New(pool, enricher, adminLogger, learningLogger, cfg.DefaultUserID, cfg.DefaultTargetLang, cfg.DefaultDefinitionLang)

	resolvedUserID := strings.TrimSpace(userID)
	if resolvedUserID == "" && strings.TrimSpace(email) != "" {
		resolvedUserID, err = svc.ResolveUserIDByEmail(ctx, email)
		if err != nil {
			slog.Error("resolve email failed", "error", err)
			os.Exit(1)
		}
		slog.Info("resolved user", "email", email, "user_id", resolvedUserID)
	}

	ids, err := listWordIDs(ctx, pool, svc, strings.TrimSpace(wordID), resolvedUserID, limit)
	if err != nil {
		slog.Error("list words failed", "error", err)
		os.Exit(1)
	}
	slog.Info("retranslate-senses starting",
		"count", len(ids),
		"dry_run", dryRun,
		"user_id", resolvedUserID,
	)

	ok, failed := 0, 0
	for i, id := range ids {
		if dryRun {
			previews, err := svc.PreviewRetranslateWord(ctx, id)
			if err != nil {
				failed++
				slog.Error("dry-run preview failed", "word_id", id, "error", err)
				if !continueOnError {
					os.Exit(1)
				}
				continue
			}
			for _, p := range previews {
				slog.Info("dry-run match",
					"lemma", p.Lemma,
					"pos", p.PartOfSpeech,
					"old_def", p.OldDefinition,
					"old_ko", p.OldLocalized,
					"new_def", p.NewDefinition,
					"new_ko", p.NewLocalized,
					"active_cards", p.UserCardCount,
				)
			}
			if len(previews) == 0 {
				slog.Info("dry-run word has no existing senses", "word_id", id)
			}
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

func listWordIDs(ctx context.Context, pool *pgxpool.Pool, svc *words.Service, wordID, userID string, limit int) ([]string, error) {
	if wordID != "" {
		return []string{wordID}, nil
	}
	if userID != "" {
		return svc.ListWordIDsForUser(ctx, userID, limit)
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
