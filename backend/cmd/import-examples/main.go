package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"

	"project-pn/internal/config"
	"project-pn/internal/db"
)

func main() {
	var (
		word      string
		lang      string
		pos       string
		sense     int
		trLang    string
		filePath  string
	)

	cfg := config.Load()
	flag.StringVar(&word, "word", "", "lemma to import examples for (required)")
	flag.StringVar(&lang, "lang", cfg.DefaultTargetLang, "target word language code")
	flag.StringVar(&pos, "pos", "", "part of speech (required)")
	flag.IntVar(&sense, "sense", 1, "meaning_order of the target sense")
	flag.StringVar(&trLang, "tr-lang", cfg.DefaultDefinitionLang, "translation language code")
	flag.StringVar(&filePath, "file", "", "input file (stdin when omitted)")
	flag.Parse()

	if strings.TrimSpace(word) == "" || strings.TrimSpace(pos) == "" {
		slog.Error("missing required flags", "word", word, "pos", pos)
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	normalized := normalize(word)
	var wordSenseID string
	err = pool.QueryRow(ctx, `
		select ws.id::text
		from words w
		join word_senses ws on ws.word_id = w.id
		where w.language_code = $1
		  and w.normalized_text = $2
		  and w.part_of_speech = $3
		  and ws.meaning_order = $4`,
		lang, normalized, strings.ToLower(strings.TrimSpace(pos)), sense,
	).Scan(&wordSenseID)
	if err != nil {
		slog.Error("word sense not found",
			"word", normalized, "lang", lang, "pos", pos, "sense", sense, "error", err)
		os.Exit(1)
	}

	reader, closer, err := openInput(filePath)
	if err != nil {
		slog.Error("open input", "error", err)
		os.Exit(1)
	}
	if closer != nil {
		defer closer.Close()
	}

	inserted := 0
	skipped := 0
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.Split(line, "\t")
		sentence := strings.TrimSpace(parts[0])
		if sentence == "" {
			continue
		}

		var translation, difficulty string
		if len(parts) > 1 {
			translation = strings.TrimSpace(parts[1])
		}
		if len(parts) > 2 {
			difficulty = normalizeDifficulty(parts[2])
		}

		var exists bool
		if err := pool.QueryRow(ctx, `
			select exists(
				select 1 from examples
				where word_sense_id = $1::uuid and sentence = $2
			)`, wordSenseID, sentence,
		).Scan(&exists); err != nil {
			slog.Error("dedupe check failed", "error", err)
			os.Exit(1)
		}
		if exists {
			skipped++
			continue
		}

		var exampleID string
		if err := pool.QueryRow(ctx, `
			insert into examples (word_sense_id, sentence, difficulty_level, source)
			values ($1::uuid, $2, $3, 'manual_import')
			returning id::text`,
			wordSenseID, sentence, nullString(difficulty),
		).Scan(&exampleID); err != nil {
			slog.Error("insert example failed", "sentence", sentence, "error", err)
			os.Exit(1)
		}

		if translation != "" {
			if _, err := pool.Exec(ctx, `
				insert into example_translations (example_id, language_code, translation)
				values ($1::uuid, $2, $3)
				on conflict (example_id, language_code) do nothing`,
				exampleID, trLang, translation,
			); err != nil {
				slog.Error("insert example translation failed", "sentence", sentence, "error", err)
				os.Exit(1)
			}
		}
		inserted++
	}
	if err := scanner.Err(); err != nil {
		slog.Error("read input", "error", err)
		os.Exit(1)
	}

	fmt.Printf("import-examples: inserted=%d skipped=%d sense_id=%s\n", inserted, skipped, wordSenseID)
}

func openInput(path string) (io.Reader, io.Closer, error) {
	if strings.TrimSpace(path) == "" {
		return os.Stdin, nil, nil
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	return f, f, nil
}

func normalize(text string) string {
	return strings.ToLower(strings.Join(strings.Fields(text), " "))
}

func normalizeDifficulty(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "easy", "medium", "hard":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func nullString(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	v := strings.TrimSpace(s)
	return &v
}
