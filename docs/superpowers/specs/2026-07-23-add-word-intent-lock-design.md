# Add-Word Intent Lock & Sense Diversity Design

Date: 2026-07-23  
Mockup: `docs/superpowers/specs/2026-07-23-add-word-intent-mockup.html`

## Overview

Improve Add Word and practice so users can **lock the meaning they intended**, the global catalog offers **distinct** senses to choose from, and each sense has **exactly one** example. Practice corrections emphasize the **target language** definition, with the display-language gloss secondary.

## Goals

- Let the user capture intent via **context → ranked/new global senses → select one → save**.
- Keep the server as the source of **various distinct meanings**; the user selects from that list (no free-form editing of sense text).
- Context-aware enrichment may **append** new global senses when none fit; never overwrite existing senses.
- Once a user adds a `word_sense_id`, practice always uses that sense (no meaning drift for that card).
- Enforce **one example sentence per `word_sense`**, including a migration that trims existing multi-example rows.
- Enrichment should prefer **non-similar / distinct** senses so the picker is useful.
- Practice corrections: **target lemma + target definition** primary; native/display gloss secondary.

## Non-Goals

- Personal private gloss as the quiz answer key (user does not author sense text).
- Rewriting or reshuffling senses already bound to a user’s learning items.
- Multi-example difficulty sets (easy/medium/hard) per sense.
- Redesigning Capture / passage tap-to-add in this spec (Manual Add intent-lock is in scope; Capture may reuse the same select step later).
- Changing FSRS / review scheduling logic.

## Context

Project PN already:

- Treats `user_word_senses` as the learnable unit (global sense + personal schedule).
- Caches global `words` / `word_senses` and enriches on cache miss; supports force-generate to append senses.
- Has `user_word_senses.source_context` and `personal_note` in the MVP schema, but they are not wired through the add flow.
- Asks the enricher for **3–5 examples per sense** today (`backend/internal/enrich/openai.go`), and allows many `examples` rows per sense.

Pain today: multi-meaning words don’t lock the user’s intention clearly; quizzes can feel like a different meaning; corrections lean on the start/display language; examples are many-per-sense instead of a fixed one-to-one.

## Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Approach | Context-first find-my-sense flow | Matches “save my intention” without personal sense authorship |
| Sense ownership | Global catalog; user selects | Server covers various meanings; selection is the lock |
| Missing sense | Context may create new global senses, then user selects | Catalog grows; no free-form edit |
| Similar senses | Prefer distinct meanings in enrich + list | Picker must show different intents, not near-duplicates |
| Examples | Exactly one per sense + migrate trim | Stable quiz surface; one meaning ↔ one example |
| Practice correction | Target definition primary; native gloss secondary | Emphasize target language in feedback |
| Context storage | Persist on `user_word_senses.source_context` | Provenance only; does not change bound sense |

## Architecture

```text
User: word + source_context
        │
        ▼
POST /api/words/lookup (optional source_context, force)
        │
        ├─ rank existing distinct word_senses
        ├─ if weak/no fit: enrich appends new global sense(s)
        │     (append-only; 1 example each; distinct from existing)
        └─ return sense_options
        │
        ▼
UI: user selects exactly one word_sense_id
        │
        ▼
POST /api/learning-items { word_sense_id, source_context, deck_id }
        │
        ▼
user_word_senses bound forever to that word_sense_id
practice corrections: target def primary, localized gloss secondary
```

### Stability rules

1. Never mutate definition text of a `word_sense` that users may already be learning (enrichment is append-only for new senses).
2. Growing the catalog must not change an existing card’s `word_sense_id`.
3. Quizzes and learning-item payloads always resolve through the locked sense’s single example.

## API & data

### Lookup

- Extend `POST /api/words/lookup` with optional `source_context`.
- When `source_context` is present:
  - Prefer ranking existing senses against the context.
  - If none fit well enough (or `force: true` after refine), call enricher to **append** distinct new sense(s) with exactly one example each.
- Response `sense_options` continue to include canonical (target) definition fields and localized fields; UI treats target as primary.

### Learning items

- `POST /api/learning-items` accepts `source_context` and persists it on `user_word_senses`.
- Idempotent on `(user_id, word_sense_id)` as today.
- Updating context later (if ever exposed) must not change `word_sense_id`.

### Schema / migration

- No new tables required for MVP of this feature.
- Add DB constraint or application invariant: **at most one** (preferably exactly one) `examples` row per `word_sense_id`.
- Migration **C**: for each `word_sense` with multiple examples, keep one canonical example (deterministic rule, e.g. lowest `created_at` then `id`), delete other `examples` rows (cascade `example_translations`).
- Senses with zero examples: out of band / enricher repair path — new enrichment must always supply one; document handling for orphans in the implementation plan.

### Enricher

- Change generation instructions from “3–5 examples spanning difficulties” to **exactly one** example per sense.
- Instruct the model to return **mutually distinct** senses (different intents), and when appending, not to repeat existing definitions.
- Validation rejects: zero examples, more than one example per sense, empty definitions, duplicate/near-duplicate senses when detectable (exact normalized definition match at minimum).

## UI

Follow the approved mockup (`2026-07-23-add-word-intent-mockup.html`):

1. **Context** — word, “where you saw it”, optional POS → Find my sense  
2. **Select** — list of distinct senses; target definition + single example primary; display gloss secondary; pick exactly one  
3. **Save** — confirm lock + deck; persist selection  

Practice feedback hierarchy:

1. Target word  
2. Target-language definition (and the one example)  
3. Display-language gloss as secondary/supporting text  

## Error handling

| Situation | Behavior |
|-----------|----------|
| Enricher unavailable on miss | Existing 503-style messaging; do not invent a silent wrong sense |
| Context yields no usable distinct sense | Prompt to refine context; allow retry / force append path |
| User tries to save with no selection | Block client-side |
| Display translation missing on add | Keep existing on-demand translate + 422 if still unavailable |
| Migration finds multi-example sense | Trim to one canonical example |

## Testing

- Enrich validation: exactly one example per sense; reject extras; prefer/require distinct definitions.
- Migration: multi-example senses → exactly one remaining example + translations.
- Lookup with context can append a new sense without modifying prior sense rows or existing `user_word_senses` bindings.
- Add item stores `source_context` and due/practice reads always use the chosen `word_sense_id`.
- Frontend: Manual Add three-step flow; practice correction shows target definition before localized gloss.
- Regression: force-generate / cache-hit lookup still work; no overwrite of cached sense text.

## Rollout notes

- Ship migration before or with enricher prompt change so new and old data agree on 1:1 examples.
- Feature can land behind a gradual UI swap on Manual Add; Capture/passage can adopt the same select step in a follow-up if needed.

## Open implementation details (resolved in plan, not product ambiguity)

- Exact ranking signal for “weak match” vs append (heuristic threshold vs always show existing then force-append on user action).
- Canonical example choice rule for migration (recommend: earliest `created_at`, tie-break `id`).
- Whether Capture tab reuses this flow in the same PR or a follow-up (default: Manual Add first).
