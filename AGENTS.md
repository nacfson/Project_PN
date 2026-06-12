# Project PN Agent Guide

## Project Context

Project PN is currently in early planning. The main documented backend direction is a local PostgreSQL vocabulary-learning backend.

Core backend principle:

- A word is global, but memory is personal.
- The learnable unit is `user_word_senses`, not `user_words`.
- Global dictionary data belongs in `words` and `word_senses`.
- User progress belongs in `user_word_senses`, `review_states`, and `review_attempts`.

## Task Routing (반드시 준수할 것)

작업의 종류에 따라 코드를 수정하기 전 아래의 연관 문서를 반드시 먼저 읽고 지시사항을 따르세요.

- **Backend schema, PostgreSQL migrations, vocabulary data model, spaced repetition, review history, or learning-state logic 수정 시**: `docs/backend-schema-brainstorm.md`
- **MVP scope 변경, study sessions, imports, tags, collections, AI enrichment, writing, or speaking 기능 추가 시**: `docs/backend-schema-brainstorm.md`

## Backend Rules

- Backend target is local PostgreSQL unless the user explicitly changes it.
- Use `pgcrypto` UUID primary keys for planned PostgreSQL tables.
- Do not assume Supabase Auth, Supabase RLS, Firebase Auth, or client-direct database access.
- Keep the MVP schema lean:
  - `users`
  - `words`
  - `word_senses`
  - `user_word_senses`
  - `review_states`
  - `review_attempts`
  - `examples`
- Treat `review_states.due_at` as the scheduling source of truth.
- Treat `review_attempts` as append-only history.
- Do not store user mastery, schedule, confidence, notes, or progress on global `words` or `word_senses`.
- Do not reintroduce `user_words` as the main learning table.

## Future Scope Rules

The following are future expansion tables unless the user explicitly expands MVP scope:

- `study_sessions`
- `session_items`
- `collocations`
- `word_families`
- `sources`
- `source_words`
- `tags`
- `user_word_tags`
- `collections`
- `collection_words`
- `ai_enrichment_jobs`
- `writing_attempts`
- `speaking_attempts`

## Work Rules

- Before adding new functionality, inspect existing docs/code for reusable patterns.
- Before writing, editing, or deleting files, clearly state what will change.
- Do not run destructive commands without explicit user approval.
- After code edits, run the relevant build or validation command when one exists.
- For documentation-only edits, verify by reading/searching the changed document.
