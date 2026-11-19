# Import Feature

## Overview
Implements the Anki CSV vocabulary import workflow. It separates backend preview/import state management in `useAnkiImport` from the paste-review-summary screen (`AnkiImportScreen`) and per-card conflict resolution picker (`ImportConflictPicker`).

## Interface
- `AnkiImportScreen({ languageCode?, definitionLanguageCode? })` `[AnkiImportScreen.tsx:AnkiImportScreen]` — Full Anki CSV import flow with collapsible instructions, CSV textarea, preview conflict review list, and import completion summary (defaults: `languageCode = 'en'`, `definitionLanguageCode = 'ko'`).
- `ImportConflictPicker({ item, selectedAction, onSelect })` `[ImportConflictPicker.tsx:ImportConflictPicker]` — Card UI showing a previewed Anki card's front/back text, matched existing senses, and valid action buttons.
- `useAnkiImport({ languageCode, definitionLanguageCode })` `[useAnkiImport.ts:useAnkiImport]` — Hook returning `{ csvText, setCsvText, preview, actions, loading, importing, error, result, previewFromText, setCardAction, importCards, reset }`.

## Invariants
- `useAnkiImport.previewFromText` rejects empty/whitespace-only `csvText` before making a request and seeds `actions[item.index]` from each preview item's `suggested_action` `[useAnkiImport.ts:useAnkiImport]`.
- `useAnkiImport.importCards` returns early if `preview` is `null`; each card's resolved action falls back from `actions[index]` to the matching preview item's `suggested_action` to `'skip'`, and `preview` is cleared to `null` after a successful import `[useAnkiImport.ts:useAnkiImport]`.
- `ImportConflictPicker` gates available actions by `item.status`: `overwrite_meaning` only when `status === 'conflict'` and `matched_senses.length > 0`; `create_new_meaning` when `status === 'conflict'` or `'existing_word_match'`; `add` only when `status === 'new_word'`; and `skip` always `[ImportConflictPicker.tsx:ImportConflictPicker]`.
- `AnkiImportScreen` displays at most the first 5 import error entries (`result.errors.slice(0, 5)`) in the completion card `[AnkiImportScreen.tsx:AnkiImportScreen]`.

## Side Effects
- Sends multipart `FormData` (`text`, `language_code`, `definition_language_code`) to `previewAnkiImport` and posts the resolved card list to `importAnkiCards` `[useAnkiImport.ts:useAnkiImport]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`
