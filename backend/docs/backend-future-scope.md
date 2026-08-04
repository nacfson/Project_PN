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

Curriculum packs are the realized form of the former `collections` / `collection_words` expansion for curated lists:

- `curriculum_packs`
- `curriculum_pack_entries`
- `user_curriculum_enrollments`
- `decks.origin` / `decks.curriculum_pack_id`

See `backend/docs/backend-schema-mvp.md`. Private add-word remains the default origin; curriculum is an isolated second origin.

## Future Notes

- `study_sessions` and `session_items` are useful for session summaries, but `review_attempts` is enough for MVP history.
- `sources` and `source_words` are useful for imported articles, subtitles, PDFs, and reading workflows.
- `tags` / `user_word_tags` remain useful for free-form user grouping beyond curriculum packs.
- The MVP already accepts `writing` and `speaking` as `review_attempts.activity_type` values (see `backend/docs/backend-schema-mvp.md`), so individual activity rows can be recorded today. Dedicated `writing_attempts` and `speaking_attempts` tables (with their own evaluation, feedback, and grading fields) become useful when productive-use workflows become first-class features.
- `ai_enrichment_jobs` can be added when definitions, examples, cloze questions, or feedback are generated asynchronously. The current enrichment path is synchronous and in-request (see `backend/docs/go-backend-setup.md`), which is fine for low traffic but blocks the request while the model responds.

## Current MVP Reference

The current MVP schema is defined in `backend/docs/backend-schema-mvp.md`. Do not add future scope tables to the MVP schema unless the user explicitly changes the MVP boundary.
