# Learning Daily Log Design

## Overview

Append learning analytics events from the Project PN backend to **instance-local daily log files** (e.g. `20260726_log`). Each file contains one **key=value row per event**. The user aggregates these files offline in their own data pipeline to analyze:

1. **Repeated failures** — words/senses that fail reviews often.
2. **Near-identical gloss overlaps** — similar meanings added as different words (simple definition/gloss text matching in the pipeline).

This slice does **not** include: Insights UI, new PostgreSQL rollup tables, stats/insights HTTP APIs, or changes to existing `admin.log` format.

## Goals

- Emit only events and fields useful for failure analysis and gloss-overlap detection.
- Keep append-only, daily file layout suitable for local tail/grep/ETL.
- Do not fail learning HTTP requests if log writes fail.
- Stay separate from human-readable `admin.log` (ops/auth).

## Non-Goals

- Structured JSON or NDJSON (user chose key=value rows).
- Storing raw prompts, user answers, emails, IPs, or session tokens in learning logs.
- In-app analytics dashboard or export API.
- Semantic/embedding similarity (v1 overlap detection is offline on definition/gloss text).
- Archive/sense-change actions from analytics (view-only in future UI; optional log events only).

## Context

- Quiz history is persisted in PostgreSQL `review_attempts` (append-only).
- Learnable unit is `user_word_senses`; global senses live in `word_senses`.
- Existing `admin.log` (`ADMIN_LOG_PATH`) logs `ADD_WORD`, `ADD_ITEM`, auth, metrics — not per-review detail.
- User will run aggregation **locally** on daily files only; they own the pipeline.

## Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Storage | Daily plain-text files | User requested `YYYYMMDD_log` pattern |
| Row format | Space-separated `key=value` | User choice; simple to parse |
| Time bucketing | UTC calendar day in filename | Stable daily files across restarts |
| vs admin.log | Separate directory + writer | Avoid mixing ops prose with analytics rows |
| Overlap signal | `definition` + `localized_definition` on add | Simple string match in pipeline (no AI) |
| Failure signal | `review_attempted` with rating, correctness, FSRS snapshot | Matches scheduler and leech semantics |

## Architecture

```text
Add learning item / Submit review (after DB commit)
        │
        ▼
LearningLog writer (mutex, append-only)
        │
        ▼
{LEARNING_LOG_DIR}/YYYYMMDD_log
        │
        ▼
User local daily aggregation pipeline
```

- **Writer:** New small package (e.g. `backend/internal/learninglog`) mirroring `admin.FileLogger` patterns: mkdir, open append, mutex, noop when dir unset.
- **Configuration:** `LEARNING_LOG_DIR` — absolute directory path. Empty disables learning logs (noop logger).
- **Filename:** `{YYYYMMDD}_log` where `YYYYMMDD` is UTC date of event `ts`.

## Row Format

- One event per line, UTF-8, newline-terminated.
- Tokens: space-separated `key=value`.
- **Required first keys:** `ts` (RFC 3339 UTC), then `event`.
- Remaining keys: fixed order per event type (below) for stable grepping.
- Booleans: `true` / `false`.
- Numbers: unquoted.
- Strings: unquoted if matching `[A-Za-z0-9_.:-]+`; otherwise double-quoted with `\` and `"` escaped inside quotes.

### Example rows

```text
ts=2026-07-26T09:12:03Z event=learning_item_added user_id=550e8400-e29b-41d4-a716-446655440000 uws_id=... word_sense_id=... lemma=charge pos=verb definition="to ask someone to pay" localized_definition="요금을 청구하다" lang_pair=en-ko source_context=""
ts=2026-07-26T09:15:44Z event=review_attempted user_id=550e8400-e29b-41d4-a716-446655440000 uws_id=... word_sense_id=... lemma=charge activity_type=cloze rating=again is_correct=false response_time_ms=4200 learning_stage=learning fsrs_state=Learning difficulty=7.2 stability=1.4 leech=false
```

## Event Catalog

### Required events

#### `learning_item_added`

Emit when a **new** `user_word_senses` row is created (idempotent re-add should not duplicate this row).

| Key | Type | Purpose |
|-----|------|---------|
| `ts` | RFC3339 | Ordering / daily file |
| `event` | literal | `learning_item_added` |
| `user_id` | uuid | Per-user aggregation |
| `uws_id` | uuid | Join to reviews |
| `word_sense_id` | uuid | Sense identity |
| `lemma` | string | Human grouping |
| `pos` | string | Disambiguate lemma |
| `definition` | string | Gloss-overlap (learning language) |
| `localized_definition` | string | Gloss-overlap (native gloss) |
| `lang_pair` | string | e.g. `en-ko` |
| `source_context` | string | Optional add context (empty string if none) |

#### `review_attempted`

Emit after successful persistence of `review_attempts` and associated `review_states` update (same transaction boundary as today’s review flow).

| Key | Type | Purpose |
|-----|------|---------|
| `ts` | RFC3339 | Time series / streaks |
| `event` | literal | `review_attempted` |
| `user_id` | uuid | Scope |
| `uws_id` | uuid | Per-item failure rollup |
| `word_sense_id` | uuid | Join to add events |
| `lemma` | string | Readable without DB |
| `activity_type` | string | Mode weakness (`meaning_to_word`, `cloze`, `word_to_meaning`, …) |
| `rating` | string | `again`, `hard`, `good`, `easy` |
| `is_correct` | bool | Objective outcome |
| `response_time_ms` | int | Struggle signal (omit key if null in DB) |
| `learning_stage` | string | From `user_word_senses.learning_stage` |
| `fsrs_state` | string | Card state after review |
| `difficulty` | float | FSRS difficulty after review |
| `stability` | float | FSRS stability after review |
| `leech` | bool | `true` if leech flagged in attempt metadata |

### Optional events (recommended if call sites already exist)

#### `sense_changed`

When user changes learning item sense without resetting schedule.

| Key | Notes |
|-----|-------|
| `uws_id`, `word_sense_id` (old), `new_word_sense_id`, `lemma`, `definition`, `localized_definition` | Pipeline can treat as remount, not duplicate add |

#### `learning_item_archived`

When item is archived.

| Key | Notes |
|-----|-------|
| `uws_id`, `word_sense_id`, `lemma` | Pipeline excludes archived from overlap/failure active sets |

## Call Sites

| Location | Event |
|----------|-------|
| Add learning item — new row only | `learning_item_added` |
| Single/batch review success path | `review_attempted` |
| Change sense handler (if present) | `sense_changed` |
| Archive learning item (if present) | `learning_item_archived` |

Do **not** log: auth, HTTP metrics, enrich failures, or full review prompts/answers.

## Error Handling

- Log write errors: log to `slog` only; **must not** roll back or fail the user-facing request.
- If directory creation fails at startup: disable learning logger with warning; server continues.
- Panics in logger must not propagate to handlers.

## Security and Privacy

- Rows contain `user_id` and vocabulary text only — no email, IP, bearer tokens, or answer text.
- Directory permissions: same as admin log (`0750` dir, `0640` files) and outside web root.

## Testing

- Unit: key=value encoding (quoting, escapes), daily filename from UTC `ts`, concurrent append safety.
- Integration: add learning item emits one `learning_item_added` row; review emits one `review_attempted` row.
- Failure: simulated write error does not fail review HTTP response.

## Pipeline Hints (out of repo scope)

User’s local aggregator can:

- **Failures:** group by `uws_id` / `lemma`, count `rating=again`, `is_correct=false`, rising `difficulty`, `leech=true`.
- **Overlaps:** normalize `definition` and `localized_definition` (trim, lower, collapse whitespace), bucket identical or near-identical strings across different `lemma` + `word_sense_id` from `learning_item_added` rows.

## Migration Impact

None. No database schema changes.

## Future Considerations

- Optional NDJSON mode behind env flag if pipeline prefers JSON lines.
- Ship logs off-host via external agent (not in app).
- Later Insights UI can read same aggregates the user builds locally, or a read API can be added without changing row schema.
