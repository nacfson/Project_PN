# Frontend Design System & Theme (`frontend/src/theme`)

## Overview
Design tokens, typography/font resolution, motion presets, and theme context provider for the Project PN frontend (KidLearn palette, learning-stage colors, spacing/radii/shadow scales, Hangul-aware font selection, and reduced-motion detection).

## Interface
- `[index.ts:ThemeProvider]` / `[index.ts:useTheme]` — barrel exports for theme context alongside `* from './tokens'`.
- `[ThemeProvider.tsx:ThemeProvider]` / `[ThemeProvider.tsx:useTheme]` / `[ThemeProvider.tsx:ThemeContextValue]` — React provider supplying `{ ...theme, colors, motion, reduced }` and loading bundled Expo font assets.
- `[tokens.ts:colors]` / `[tokens.ts:Colors]` — semantic color palette (`brandPrimary`, `brandSecondary`, `canvas`, `surface`, `text`, `hairline`, `danger`, `success`, `warning`, `infoSurface`, `scrim`, etc.).
- `[tokens.ts:stage]` / `[tokens.ts:StageKey]` / `[tokens.ts:stageColor]` — learning-stage palette (`new`, `learning`, `recognized`, `recalled`, `usable`, `mastered`) and safe color resolver.
- `[tokens.ts:spacing]` / `[tokens.ts:radii]` / `[tokens.ts:controlHeight]` / `[tokens.ts:layout]` / `[tokens.ts:shadows]` / `[tokens.ts:iconSizes]` / `[tokens.ts:typography]` / `[tokens.ts:theme]` / `[tokens.ts:Theme]` — immutable layout, elevation, icon, and typography token scales.
- `[fonts.ts:fontFamilies]` / `[fonts.ts:webFontStacks]` / `[fonts.ts:fontAssets]` / `[fonts.ts:containsHangul]` / `[fonts.ts:fontFamilyFor]` / `[fonts.ts:FontRole]` / `[fonts.ts:FontWeightName]` — font asset map (Geist, Geist Mono, Newsreader, IBM Plex Sans KR) and platform/script-aware font-family resolver.
- `[motion.ts:spring]` / `[motion.ts:timing]` / `[motion.ts:scale]` / `[motion.ts:useReducedMotion]` — spring presets (`bouncy`, `gentle`, `stiff`), timing durations (`fade`, `loading`), press/pop scales, and reduced-motion hook.

## Invariants
- `useTheme()` throws `Error('useTheme must be used within a ThemeProvider')` if invoked outside `ThemeProvider` `[ThemeProvider.tsx:useTheme]`.
- On native platforms (`Platform.OS !== 'web'`), `ThemeProvider` returns `null` until `useFonts(fontAssets)` finishes loading `[ThemeProvider.tsx:ThemeProvider]`.
- `stageColor(key)` falls back to `stage.new` for unknown stage keys `[tokens.ts:stageColor]`.
- `fontFamilyFor()` switches to Korean font families (`IBMPlexSansKR-*`) whenever `options.lang === 'ko'` or `containsHangul(options.text)` matches Unicode Hangul ranges, while keeping `role === 'mono'` strictly monospace `[fonts.ts:fontFamilyFor]`.
- Web font asset entries are wrapped with `FontDisplay.SWAP` via `withSwap()` `[fonts.ts:withSwap]`.

## Side Effects
- Calls `clearLegacyThemePreferences()` on `ThemeProvider` mount to remove deprecated theme storage keys `[ThemeProvider.tsx:ThemeProvider]`.
- Appends a `<link id="kidlearn-google-fonts" rel="stylesheet">` element for Google Fonts (Fredoka, Nunito, Roboto Mono) into `document.head` on web if absent `[ThemeProvider.tsx:ThemeProvider]`.
- Loads font assets via `useFonts(fontAssets)` and subscribes to `window.matchMedia('(prefers-reduced-motion: reduce)')` (web) or `AccessibilityInfo` `reduceMotionChanged` (native) `[ThemeProvider.tsx:ThemeProvider]`, `[motion.ts:useReducedMotion]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`
