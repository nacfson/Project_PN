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
collections
collection_words
ai_enrichment_jobs
writing_attempts
speaking_attempts
```

## Future Notes

- `study_sessions` and `session_items` are useful for session summaries, but `review_attempts` is enough for MVP history.
- `sources` and `source_words` are useful for imported articles, subtitles, PDFs, and reading workflows.
- `tags`, `collections`, and `collection_words` are useful for exam lists, courses, and custom grouping.
- The MVP already accepts `writing` and `speaking` as `review_attempts.activity_type` values (see `backend/docs/backend-schema-mvp.md`), so individual activity rows can be recorded today. Dedicated `writing_attempts` and `speaking_attempts` tables (with their own evaluation, feedback, and grading fields) become useful when productive-use workflows become first-class features.
- `ai_enrichment_jobs` can be added when definitions, examples, cloze questions, or feedback are generated asynchronously. The current enrichment path is synchronous and in-request (see `backend/docs/go-backend-setup.md`), which is fine for low traffic but blocks the request while the model responds.

## Current MVP Reference

The current MVP schema is defined in `backend/docs/backend-schema-mvp.md`. Do not add future scope tables to the MVP schema unless the user explicitly changes the MVP boundary.
