# Backend Future Scope

## Expansion Rule

Add future expansion tables only after the lean MVP is working and the user explicitly expands scope.

## Future Expansion Tables

```text
study_sessions
session_items
collocations
word_families
sources
source_words
tags
user_word_tags
ai_enrichment_jobs
writing_attempts
speaking_attempts
```

## Realized From Future Scope

Former `collections` / `collection_words` and curriculum packs were tried and later **removed** from MVP (`000022_drop_curriculum`). Private decks remain the only grouping. Reintroduce curated packs only with an explicit scope expansion.

**Multi-word phrases** are in MVP without packs: learners add them to private decks like single words (`words` / `word_senses` / `user_word_senses`). Enrichment prefers the LLM for multi-word lemmas because WiktApi coverage is weak; compact phrase glosses (e.g. `~하는 데`) are accepted by the propriety filter.

## Future Notes

- `study_sessions` and `session_items` are useful for session summaries, but `review_attempts` is enough for MVP history.
- `sources` and `source_words` are useful for imported articles, subtitles, PDFs, and reading workflows.
- `tags` / `user_word_tags` remain useful for free-form user grouping.
- The MVP already accepts `writing` and `speaking` as `review_attempts.activity_type` values (see `backend/docs/backend-schema-mvp.md`), so individual activity rows can be recorded today. Dedicated `writing_attempts` and `speaking_attempts` tables (with their own evaluation, feedback, and grading fields) become useful when productive-use workflows become first-class features.
- `ai_enrichment_jobs` can be added when gloss lookup or feedback runs asynchronously. Default gloss lookup is synchronous WiktApi in-request (see `backend/docs/go-backend-setup.md`).
- **Personal manual gloss** is in MVP when stored only on `user_word_senses.personal_note` (never inserted into shared `word_senses` / `sense_translations`) and audited via learning-log `personal_meaning_set`. Shared catalog free-text gloss (typed text becoming a global sense row) remains out of scope. If a shared catalog path is added later, it must pass `enrich.FilterProperSenses` (simple display-language gloss, not empty, not a near-duplicate).

## Current MVP Reference

The current MVP schema is defined in `backend/docs/backend-schema-mvp.md`. Do not add future scope tables to the MVP schema unless the user explicitly changes the MVP boundary.
