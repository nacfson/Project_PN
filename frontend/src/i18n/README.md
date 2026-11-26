# Frontend Internationalization (`frontend/src/i18n`)

## Overview
Application UI localization layer supporting English (`en`) and Korean (`ko`) translations, device-locale defaulting, persistent language preference storage, parameter interpolation (`{key}`), and localized learning-language labels.

## Interface
- `csv/<prefix>.csv` — canonical per-domain RFC 4180 CSV translation sources (`key,en,ko`, UTF-8 without BOM, LF). Edit these files rather than `translations.ts`, then run `npm run i18n:sync`.
- `[index.ts:AppLanguageProvider]` / `[index.ts:useAppLanguage]` / `[index.ts:AppLanguage]` / `[index.ts:TranslationKey]` — public barrel exports for the i18n subsystem.
- `[AppLanguageProvider.tsx:AppLanguageProvider]` — React context provider managing active `AppLanguage` (`'en' | 'ko'`), persisting changes, and providing `t(key, params?)` and `languageLabel(code)`.
- `[AppLanguageProvider.tsx:useAppLanguage]` — hook returning `{ language, setLanguage, t, languageLabel }`.
- `[translations.ts:en]` — auto-generated English string dictionary (`as const`) built from `csv/*.csv`.
- `[translations.ts:TranslationKey]` — union of all valid translation keys derived from `keyof typeof en`.
- `[translations.ts:ko]` — auto-generated Korean string dictionary typed as `Record<TranslationKey, string>`.
- Workflow commands (from repo root):
  - `npm run i18n:sync` — validates `csv/*.csv` and regenerates `translations.ts`.
  - `npm run i18n:check` — strictly validates CSV schema, key/prefix safety, `{placeholder}` parity, and byte-for-byte sync with `translations.ts`.
  - `npm run i18n:export` — exports all domain CSVs into a single UTF-8-with-BOM CSV (`frontend/src/i18n/translations.export.csv`, gitignored) for spreadsheet editing.
  - `npm run i18n:import -- <path>` — validates and imports a combined CSV back into `csv/*.csv` and regenerates `translations.ts`.

## Invariants
- `useAppLanguage()` throws `Error('useAppLanguage must be used within AppLanguageProvider')` outside `AppLanguageProvider` `[AppLanguageProvider.tsx:useAppLanguage]`.
- Initial language resolves to `'ko'` if `getDeviceLanguageCode() === 'ko'`, otherwise `'en'`; persisted values other than `'en'` or `'ko'` fall back to `'en'` `[AppLanguageProvider.tsx:defaultLanguage]`, `[AppLanguageProvider.tsx:AppLanguageProvider]`.
- `t(key, params)` never returns `undefined`: it resolves `dictionaries[language][key] ?? en[key] ?? String(key)` and leaves `{name}` placeholders intact when `params[name]` is `undefined` `[AppLanguageProvider.tsx:interpolate]`, `[AppLanguageProvider.tsx:AppLanguageProvider]`.
- `languageLabel(code)` returns `t('common.unknown')` for falsy codes, the translated label for `en|ko|ja|es|fr|de|zh`, and the raw `code` string for any other code `[AppLanguageProvider.tsx:AppLanguageProvider]`.
- TypeScript enforces key parity between `en` and `ko` via `Record<TranslationKey, string>` `[translations.ts:ko]`, and `npm run i18n:check` enforces strict CSV validation and zero drift between `csv/*.csv` and `translations.ts`.

## Side Effects
- Reads device locale via `getDeviceLanguageCode()` on initialization `[AppLanguageProvider.tsx:defaultLanguage]`.
- Reads persisted preference from `appLanguageStorage.getLanguage()` on mount and persists updates via `appLanguageStorage.setLanguage(nextLanguage)` `[AppLanguageProvider.tsx:AppLanguageProvider]`.

## Verification
- Run: `npm run i18n:check`, `npm run test:scripts`, `npm test -w frontend`, and `npm run typecheck -w frontend`
