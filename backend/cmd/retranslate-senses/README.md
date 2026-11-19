# backend/cmd/retranslate-senses

## Overview
Batch maintenance CLI for re-enriching and re-translating existing dictionary word senses using WiktApi as the primary gloss origin (with optional OpenAI-compatible LLM fallback). Supports targeting a single word UUID, a specific user's active vocabulary (by `-user-id` or `-email`), or the entire `words` table, with a `-dry-run` preview mode.

## Interface
- `main()` `[main.go:main]` — CLI entrypoint parsing `-limit`, `-word-id`, `-user-id`, `-email`, `-dry-run`, and `-continue-on-error`, initializing `words.Service` with the enrichment pipeline, and running either `svc.PreviewRetranslateWord` or `svc.RetranslateWord` across selected word IDs.
- `version` `[main.go:version]` — Build-time version string variable defaulting to `"v0.0.0"`.
- `listWordIDs(ctx, pool, svc, wordID, userID, limit)` `[main.go:listWordIDs]` — Resolves the ordered list of target word UUIDs from an explicit `wordID`, a user's active learning set (`svc.ListWordIDsForUser`), or a full/limited scan of `words`.

## Invariants
- `cfg.DatabaseURL` must be non-empty; otherwise the process exits with code `1` `[main.go:main]`.
- Target selection precedence is `-word-id` > `-user-id` (or `-email` resolved via `svc.ResolveUserIDByEmail` when `-user-id` is empty) > all rows in `words` ordered by `id` `[main.go:main]`, `[main.go:listWordIDs]`.
- In `-dry-run` mode, only `svc.PreviewRetranslateWord` is called so existing sense translations are not modified `[main.go:main]`.
- When `-continue-on-error` is `false`, any per-word error immediately exits with code `1`; when `true`, processing continues for remaining words and the process exits with code `1` at the end if `failed > 0` `[main.go:main]`.
- If `learninglog.NewLogger` fails, the CLI falls back to `learninglog.NoopLogger{}` rather than failing startup `[main.go:main]`.

## Side Effects
- Reads environment configuration (`config.Load`) and CLI flags (`flag.Parse`) `[main.go:main]`.
- Opens a PostgreSQL connection pool (`db.Open`), queries `users`/`words`/`word_senses`, and mutates senses/translations via `svc.RetranslateWord` when `-dry-run` is `false` `[main.go:main]`, `[main.go:listWordIDs]`.
- Sends outbound HTTP requests to WiktApi (`cfg.OriginWiktAPIBaseURL`) and, if `cfg.EnrichPrimaryBaseURL != ""`, to the configured LLM fallback endpoint `[main.go:main]`.
- Writes structured progress and error logs to `os.Stderr`, admin audit logs via `admin.NewLogger()`, and learning logs under `cfg.LearningLogDir`; exits with code `1` on fatal or per-word failures `[main.go:main]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`
