# Frontend DTO & Ambient Types (`frontend/src/types`)

## Overview
TypeScript data transfer object interfaces mirroring Go backend JSON payloads (`backend/internal/words/types.go` and `backend/internal/http/auth_handler.go`), shared auth type re-exports from `@project-pn/api`, and ambient Chrome extension runtime typing.

## Interface
- `[auth.ts:SessionResponse]` / `[auth.ts:MeResponse]` / `[auth.ts:LanguageOptionsResponse]` / `[auth.ts:LanguagePair]` / `[auth.ts:AllowedLanguages]` / `[auth.ts:UserLanguage]` — auth and user-language DTO re-exports from `@project-pn/api`.
- `[index.ts:PartOfSpeech]` / `[index.ts:PosFilter]` — persisted parts of speech plus UI/lookup-only `'Any'` filter.
- `[index.ts:Example]` / `[index.ts:IntervalPreview]` / `[index.ts:SenseOption]` / `[index.ts:LookupRequest]` / `[index.ts:LookupResponse]` — dictionary lookup and sense option DTOs.
- `[index.ts:LearningItem]` / `[index.ts:LearningItemListItem]` / `[index.ts:LearningItemsPage]` / `[index.ts:DeckOrigin]` / `[index.ts:Deck]` — user learning-item and private deck DTOs (`DeckOrigin = 'private'`).
- `[index.ts:ReviewActivityType]` / `[index.ts:ReviewAttemptParams]` / `[index.ts:DueItem]` / `[index.ts:BatchReviewItemUpdate]` / `[index.ts:BatchReviewResult]` — spaced-repetition review queue and batch attempt submission DTOs.
- `[index.ts:ReviewSettings]` / `[index.ts:StatsForecastDay]` / `[index.ts:StatsSummary]` / `[index.ts:StreakSettings]` — scheduling settings, streak state, and 14-day forecast summary DTOs.
- `[index.ts:AnkiCard]` / `[index.ts:ImportAction]` / `[index.ts:ImportPreviewItem]` / `[index.ts:ImportPreviewResponse]` / `[index.ts:AnkiImportRequest]` / `[index.ts:ImportError]` / `[index.ts:AnkiImportResult]` — Anki CSV preview and import DTOs.
- `[index.ts:WordOfTheDay]` / `[index.ts:ContentChallenge]` — curated content DTOs.
- `[global.d.ts:chrome]` — ambient global declaration for optional `chrome.runtime.sendMessage(extensionId, message)`.

## Invariants
- `PosFilter` adds `'Any'` strictly for UI/lookup filtering and must never be persisted or sent to `POST /api/learning-items` `[index.ts:PosFilter]`.
- `DeckOrigin` is constrained to `'private'` `[index.ts:DeckOrigin]`.
- `ReviewAttemptParams.rating_score` represents a raw float score in `[0.0, 3.0]` `[index.ts:ReviewAttemptParams]`.

## Side Effects
- None

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`
