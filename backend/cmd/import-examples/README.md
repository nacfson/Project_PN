# backend/cmd/import-examples

## Overview
CLI utility for bulk-importing tab-separated example sentences (with optional translations and difficulty levels) for an existing `(word, lang, pos, sense)` into PostgreSQL `examples` and `example_translations` tables from a file or standard input.

## Interface
- `main()` `[main.go:main]` — CLI entrypoint parsing `-word`, `-lang`, `-pos`, `-sense`, `-tr-lang`, and `-file` flags, resolving the target `word_sense_id`, and inserting deduplicated examples and translations.
- `version` `[main.go:version]` — Build-time version string variable defaulting to `"v0.0.0"`.
- `openInput(path string)` `[main.go:openInput]` — Opens a file for reading or returns `os.Stdin` when `path` is blank.
- `normalize(text string)` `[main.go:normalize]` — Collapses whitespace and lowercases input text to match `words.normalized_text`.
- `normalizeDifficulty(value string)` `[main.go:normalizeDifficulty]` — Normalizes difficulty tokens to `"easy"`, `"medium"`, `"hard"`, or `""`.
- `nullString(s string)` `[main.go:nullString]` — Converts blank strings to `nil` pointers for nullable SQL columns.

## Invariants
- Both `-word` and `-pos` must be non-blank after trimming; missing required flags exit with code `1` `[main.go:main]`.
- The target sense must already exist in `words` joined with `word_senses` on `(language_code, normalized_text, lower(trim(pos)), meaning_order)`; lookup failure exits with code `1` `[main.go:main]`.
- Empty lines and `#`-prefixed comment lines are skipped; remaining lines are tab-delimited as `sentence[\ttranslation[\tdifficulty]]` `[main.go:main]`.
- Sentences already present for the target `word_sense_id` are skipped via an existence check; newly inserted examples always set `source = 'manual_import'` `[main.go:main]`.
- Any difficulty string other than `easy`, `medium`, or `hard` (case-insensitive) is stored as SQL `NULL` `[main.go:normalizeDifficulty]`, `[main.go:nullString]`.

## Side Effects
- Reads environment configuration (`config.Load`) and CLI flags (`flag.Parse`) `[main.go:main]`.
- Reads input lines from disk (`os.Open`) or `os.Stdin` `[main.go:openInput]`.
- Opens a PostgreSQL connection pool (`db.Open`), queries `words`, `word_senses`, and `examples`, inserts rows into `examples`, and upserts (`ON CONFLICT (example_id, language_code) DO NOTHING`) into `example_translations` `[main.go:main]`.
- Writes structured logs to `os.Stderr` and terminates with `os.Exit(1)` on database, I/O, or validation errors `[main.go:main]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`
