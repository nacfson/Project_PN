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

- **Backend overview, backend target, product goal, or core learning principle 확인 시**: `backend/docs/backend-overview.md`
- **Backend schema, PostgreSQL migrations, vocabulary data model, table constraints, or relationships 수정 시**: `backend/docs/backend-schema-mvp.md`
- **Spaced repetition, review history, learning-stage, scheduling, or append-only attempt logic 수정 시**: `backend/docs/learning-review-model.md`
- **Add-word flow, due-review query, or review transaction flow 수정 시**: `backend/docs/backend-flows.md`
- **Go backend setup, local PostgreSQL setup, migration commands, health checks, or DB connection logic 수정 시**: `backend/docs/go-backend-setup.md`
- **MVP scope 변경, study sessions, imports, tags, collections, AI enrichment, writing, or speaking 기능 추가 시**: `backend/docs/backend-future-scope.md`
- **Migration tests, backend acceptance criteria, or schema behavior 검증 작성 시**: `backend/docs/backend-acceptance-tests.md`
- **Project PN web app을 zlUbuntu에 배포하거나, frontend web build를 build/deploy/publish 할 시**: `.cursor/skills/deploy-web-ubuntu/SKILL.md`
- **Frontend UI component, form validation, loading state, practice UX, or translation string 추가/수정 시**: `frontend/docs/frontend-ux-patterns.md`
- **Deploy 실패, nginx 오류, CORS 오류, migration password 오류, public IP unreachable, 또는 zlUbuntu에서 backend/container 예외 발생 시**: `deploy/deploy-exception-runbook.md`

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

## Frontend Rules

- Use React Native / Expo with TypeScript targeting Web, iOS, and Android.
- Ensure all screens use responsive flexbox layouts to adapt to mobile screens and web browser layouts seamlessly.
- Model client-side interfaces (`frontend/src/types`) to match backend DTO structs exactly.
- Isolate data fetching in repository wrappers within `frontend/src/api/` instead of triggering inline Axios/Fetch calls in screen UI code.
- Prefer standard React Native styling or a clean Tailwind configuration (if requested) but default to standard CSS-in-JS StyleSheet.
- Reuse the shared `Input` component and its props (`secureTextEntryToggle`, `loading`, `error`, `helperText`, `onClear`) instead of building one-off variants.
- Show soft inline validation feedback on blur, and add translation keys for both `en` and `ko` in `frontend/src/i18n/translations.ts`.
- Prefer an undo pattern over blocking confirmation dialogs for local destructive actions (e.g., clearing a passage).
- Adapt controls for desktop/web/Tauri: larger hit targets, click-to-set sliders, and keyboard shortcuts where appropriate.
- Show generic user-facing messages for missing OAuth/third-party config; expose environment-variable hints only when `__DEV__` is true.

## Future Scope Rules

Future expansion tables are listed in `backend/docs/backend-future-scope.md` and remain out of MVP unless the user explicitly expands scope.

## Work Rules

- Before adding new functionality, inspect existing docs/code for reusable patterns.
- Before writing, editing, or deleting files, clearly state what will change.
- Do not run destructive commands without explicit user approval.
- After code edits, run the relevant build or validation command when one exists.
- For documentation-only edits, verify by reading/searching the changed document.

