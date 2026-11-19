# Frontend Analytics (`frontend/src/analytics`)

## Overview
Best-effort client-side analytics batching and upload module for the Expo frontend. Wraps `@project-pn/api` event creation with per-boot session/anonymous identifiers, platform detection (`tauri`, `ios`, `android`, `web`), and bounded-batch posting to `/api/analytics/events`.

## Interface
- `[analytics.ts:AnalyticsClient]` — interface exposing `track(eventName, properties, traceId?) => string` and `flush() => Promise<void>`.
- `[analytics.ts:createAnalyticsClient]` — factory creating an isolated `AnalyticsClient` instance with custom `enabled`, `platform`, `appVersion`, and `upload` handlers.
- `[analytics.ts:analytics]` — singleton `AnalyticsClient` preconfigured from `EXPO_PUBLIC_ANALYTICS_ENABLED`, `resolvePlatform()`, `Constants.expoConfig?.version ?? 'unknown'`, and `postJson('/api/analytics/events', { events })`.

## Invariants
- Each client instance generates a fresh `sessionId` and pseudonymous `anonymousId` per app boot via `createUUID()` `[analytics.ts:createAnalyticsClient]`.
- When `options.enabled` is `false`, `track()` performs no enqueueing and still returns a valid `traceId`, and `flush()` resolves immediately `[analytics.ts:createAnalyticsClient]`.
- Concurrent `flush()` calls share the active `flushing` promise; each upload slices at most `MAX_BATCH_EVENTS` (`100`) events and automatically triggers another `flush()` when `pending.length >= 100` `[analytics.ts:createAnalyticsClient]`.
- Upload errors are swallowed intentionally without client-side retries so analytics never blocks product flows or retains learning content `[analytics.ts:createAnalyticsClient]`.

## Side Effects
- Reads `process.env.EXPO_PUBLIC_ANALYTICS_ENABLED`, `Constants.expoConfig?.version`, `Platform.OS`, and `isTauri()` (`window`) at module initialization `[analytics.ts:analytics]`.
- Mutates the in-memory `pending` event queue and `flushing` promise `[analytics.ts:createAnalyticsClient]`.
- Sends HTTP POST requests to `/api/analytics/events` via `postJson` `[analytics.ts:analytics]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`
