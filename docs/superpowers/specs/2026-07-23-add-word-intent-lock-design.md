# Add-Word Intent Lock & Sense Diversity Design

Date: 2026-07-23  
Mockup: `docs/superpowers/specs/2026-07-23-add-word-intent-mockup.html`

## Overview

Improve Add Word and practice so users can **lock the meaning they intended**, the global catalog offers **distinct** senses (no near-duplicates like 고의로 / 의도적으로 as separate items), and each sense has **exactly one** example. Practice corrections emphasize the **target language** definition, with the display-language gloss secondary.

Because the past meaning API gathered **similar** senses per word, a one-time **retranslate-all** migration rebuilds the global catalog, then **auto-matches** each learner card onto the closest new sense. Users can later **change meaning** from the My Words list without resetting schedule.

## Goals

- Let the user capture intent via **context → ranked/new global senses → select one → save**.
- Keep the server as the source of **various distinct meanings**; the user selects from that list (no free-form editing of sense text).
- Context-aware enrichment may **append** new global senses when none fit; never overwrite existing sense rows in normal operation.
- Collapse near-duplicate meanings into one sense (same intent → one list item).
- Enforce **one example sentence per `word_sense`**.
- One-time migration: **retranslate every word** in the global cache into a fresh distinct sense set (1 example each), then remap learner cards.
- Remap rule: **auto-match** old sense → closest new sense (target definition + localized gloss).
- My Words UI: allow **changing** the card’s meaning from the sense list; **keep the same learning item and FSRS schedule** (only swap `word_sense_id`).
- Practice corrections: **target lemma + target definition** primary; native/display gloss secondary.

## Non-Goals

- Personal private gloss as the quiz answer key (user does not author sense text).
- Multi-example difficulty sets (easy/medium/hard) per sense.
- Redesigning Capture / passage tap-to-add in this spec (Manual Add intent-lock is in scope; Capture may reuse the same select step later).
- Changing FSRS weight formulas or scheduling math (schedule rows are preserved across meaning swaps / remaps).
- Interactive “confirm every remap” during migration (auto-match only; user fixes via My Words afterward).

## Context

Project PN already:

- Treats `user_word_senses` as the learnable unit (global sense + personal schedule).
- Caches global `words` / `word_senses` and enriches on cache miss; supports force-generate to append senses.
- Has `user_word_senses.source_context` and `personal_note` in the MVP schema, but they are not wired through the add flow.
- Asks the enricher for **3–5 examples per sense** today (`backend/internal/enrich/openai.go`), and allows many `examples` rows per sense.
- Past enrichment tended to return **similar / overlapping** meanings for the same word, so pickers and quizzes felt unstable.

## Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Approach | Context-first find-my-sense flow | Matches “save my intention” without personal sense authorship |
| Sense ownership | Global catalog; user selects | Server covers various meanings; selection is the lock |
| Missing sense | Context may create new global senses, then user selects | Catalog grows; no free-form edit |
| Similar senses | Distinct only; integrate near-duplicates into one | Old API gathered similar meanings; picker must show different intents |
| Examples | Exactly one per sense | One meaning ↔ one example |
| Catalog cleanup | Retranslate **all** cached words | Rebuild distinct sense sets instead of brittle SQL-only merge |
| Remap after retranslate | Auto-match closest new sense | Preserve learner progress without manual confirm for every card |
| Fix wrong match | My Words “change meaning” | User corrects list selection anytime |
| Change meaning effect | Swap `word_sense_id`, keep schedule | Same card / FSRS state |
| Practice correction | Target definition primary; native gloss secondary | Emphasize target language in feedback |
| Context storage | Persist on `user_word_senses.source_context` | Provenance only; does not change bound sense by itself |

## Architecture

```text
Add (steady state)
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
practice: locked sense, target def primary, one example

One-time migration
For each words row:
  re-enrich → fresh distinct senses (1 example each)
  auto-match each user_word_senses → closest new sense
  delete obsolete old senses / extra examples
  enforce examples unique per word_sense_id

My Words (anytime)
User opens change-meaning → sense list for that word
  → PATCH learning item word_sense_id
  → review_states unchanged (same user_word_senses.id)
```

### Stability rules

1. **Steady-state enrich:** append-only new senses; do not rewrite sense text in place.
2. **One-time retranslate migration:** may replace a word’s sense set; learner cards are remapped, not dropped.
3. After migration / anytime: the bound `word_sense_id` is what practice uses until the user changes it in My Words.
4. Quizzes always use that sense’s **single** example.

## API & data

### Lookup

- Extend `POST /api/words/lookup` with optional `source_context`.
- When `source_context` is present:
  - Prefer ranking existing senses against the context.
  - If none fit well enough (or `force: true` after refine), call enricher to **append** distinct new sense(s) with exactly one example each.
- Response `sense_options`: target definition + one example primary; localized fields secondary in UI.

### Learning items

- `POST /api/learning-items` accepts `source_context` and persists it on `user_word_senses`.
- Idempotent on `(user_id, word_sense_id)` as today.
- New (or extended) endpoint for My Words: change meaning on an existing item by setting a new `word_sense_id` for the same `user_word_senses` row.
  - Preserve `id`, deck, archive state, and `review_states`.
  - If `(user_id, new_word_sense_id)` already exists, reject or merge per implementation plan (must not violate unique constraint silently).

### Schema

- Add unique index: one `examples` row per `word_sense_id`.
- No new tables required for MVP of this feature.

### Enricher (steady state + migration)

- Exactly **one** example per sense (drop 3–5 easy/medium/hard).
- Return **mutually distinct** senses (different intents). Near-duplicates (e.g. 고의로 vs 의도적으로) must be a **single** sense.
- Validation: reject zero/many examples per sense; reject exact normalized duplicate definitions at minimum; stronger near-duplicate detection in the plan.

## One-time migration: retranslate all words

### Scope

Every row in global `words` (full cache rebuild of senses).

### Procedure

1. **Snapshot** current `word_senses` (+ examples, translations) and all `user_word_senses` pointing at them.
2. For each word, call enricher for a **fresh** distinct sense set (target definitions + one example each + display-language blocks as needed).
3. Insert the new senses/examples/translations for that word (implementation may use a staging word or temporary flag — detail in plan).
4. **Auto-match** each old sense used by learners to exactly one new sense:
   - Compare old target definition + localized gloss to each new sense’s target definition + gloss.
   - Choose highest similarity; ties break deterministically (e.g. lowest new `meaning_order` / `id`).
5. **Update** `user_word_senses.word_sense_id` to the matched new sense (same row id → schedule stays). Resolve unique conflicts if a user already had two old senses that map to the same new sense (plan: keep the card with more review history / earlier `added_at`, archive or merge the other).
6. **Delete** obsolete old senses for that word (cascade examples/translations) once nothing references them.
7. Enforce `UNIQUE (word_sense_id)` on `examples`.
8. Run offline / batched with rate limits; resume-safe per `word_id`.

### After migration

- Users who were auto-matched incorrectly change meaning in **My Words**.
- New lookups never recreate near-duplicate clusters.

## UI

### Add Word

Follow the approved mockup (`2026-07-23-add-word-intent-mockup.html`):

1. **Context** — word, “where you saw it”, optional POS → Find my sense  
2. **Select** — distinct senses; target definition + single example primary; display gloss secondary  
3. **Save** — confirm lock + deck  

### My Words

- Per item: action to **change meaning**.
- Shows the word’s current distinct sense list (same hierarchy: target first).
- Selecting another sense updates the card’s `word_sense_id` only; due date / FSRS state unchanged.

### Practice

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
| Auto-match ambiguous / low confidence | Still assign best match; user can fix in My Words |
| Change meaning to a sense already on another active card for same user | Surface conflict; do not corrupt unique `(user_id, word_sense_id)` |
| Migration enrich fail for a word | Skip/retry that word; do not delete old senses until new set + remaps succeed |

## Testing

- Enrich validation: exactly one example per sense; distinct definitions; near-duplicate glosses collapse to one sense in fixtures.
- Retranslate migration: all words processed; learner cards remapped; schedules preserved on same `user_word_senses.id`.
- Auto-match: old near-duplicate pair maps to the same new sense; two genuinely different old senses map to different new senses when present.
- Change-meaning API: swaps `word_sense_id`, leaves `review_states` untouched.
- Add item stores `source_context`; practice uses locked sense’s single example.
- Frontend: Manual Add three-step flow; My Words change-meaning; practice target-first corrections.
- Regression: force-generate / cache-hit lookup; unique example constraint.

## Rollout notes

1. Ship enricher prompt/validation (1 example, distinct senses).  
2. Run retranslate-all migration + remaps + example unique index.  
3. Ship Manual Add intent UI + My Words change-meaning + practice hierarchy.  
4. Capture/passage can adopt the same select step in a follow-up.

## Open implementation details (resolved in plan, not product ambiguity)

- Similarity metric for auto-match (normalized string / token overlap / embedding).
- Low-confidence threshold logging (still auto-assign; optional admin metric).
- Exact conflict policy when two of a user’s cards collapse onto one new sense.
- Staging strategy for insert-new-then-remap-then-delete vs in-place replace.
- Whether Capture tab reuses this flow in the same PR or a follow-up (default: Manual Add first).
