# HTTP API (`httpapi`)

## Overview
Assembles the Chi HTTP router, security middleware stack (tracing, CORS, authentication, email-verification gate, double-submit CSRF protection, and per-IP rate limiting), and JSON REST handlers for authentication/BFF login, user language preferences, vocabulary lookup/learning items, spaced-repetition reviews, FSRS optimization, decks, streaks, stats, Anki import, push notifications, content discovery, and analytics ingestion.

## Interface
- Router entry point: `Dependencies`, `NewRouter(deps Dependencies) http.Handler` `[router.go:Dependencies]`, `[router.go:NewRouter]`
- Health endpoints: `GET /healthz`, `GET /readyz` `[router.go:healthz]`, `[router.go:readyz]`
- Auth & BFF endpoints (`/api/auth/*`):
  - Public: `GET /api/auth/language-options`, `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/session`, `POST /api/auth/refresh` (returns `410 Gone`) `[router.go:NewRouter]`, `[auth_handler.go:login]`, `[auth_handler.go:callback]`, `[auth_handler.go:session]`, `[auth_handler.go:refreshSessionHandler]`
  - Protected (`authMiddleware` + `csrfProtection`): `GET /api/auth/me`, `GET /api/auth/linked-providers`, `GET /api/auth/merge-suggestions`, `POST /api/auth/merge-requests`, `POST /api/auth/merge-requests/{id}/confirm`, `POST /api/auth/logout` `[router.go:NewRouter]`, `[auth_handler.go:me]`, `[auth_handler.go:linkedProviders]`, `[auth_handler.go:mergeSuggestions]`, `[auth_handler.go:createMergeRequest]`, `[auth_handler.go:confirmMergeRequest]`, `[auth_handler.go:centralLogout]`
- User language endpoints (`/api/user/*`, protected; mutations rate-limited 30 req/min): `GET /api/user/languages`, `POST /api/user/languages`, `PATCH /api/user/languages/{target_language}`, `PATCH /api/user/languages/{target_language}/active`, `DELETE /api/user/languages/{target_language}`, `GET /api/user/ui-language`, `PUT /api/user/ui-language` `[router.go:NewRouter]`, `[user_handler.go:listLanguages]`, `[user_handler.go:addLanguage]`, `[user_handler.go:updateLanguagePair]`, `[user_handler.go:setActiveLanguage]`, `[user_handler.go:removeLanguage]`, `[user_handler.go:getUILanguage]`, `[user_handler.go:setUILanguage]`
- Vocabulary, review, deck, stats, content, notification, and import endpoints (`/api/*`, protected + `requireVerified` + `csrfProtection`):
  - `POST /api/words/lookup`, `GET/POST /api/learning-items`, `POST /api/learning-items/archive`, `PATCH/DELETE /api/learning-items/{id}` `[words_handler.go:lookup]`, `[words_handler.go:listLearningItems]`, `[words_handler.go:addLearningItem]`, `[words_handler.go:archiveLearningItems]`, `[words_handler.go:changeLearningItemSense]`, `[words_handler.go:archiveLearningItem]`
  - `GET /api/reviews/due`, `POST /api/reviews/batch`, `POST /api/reviews/optimize-weights`, `GET /api/reviews/optimization-status` `[words_handler.go:getDueReviewItems]`, `[words_handler.go:recordBatchReviewAttempts]`, `[words_handler.go:optimizeWeights]`, `[words_handler.go:optimizationStatus]`
  - `GET/PATCH /api/reviews/settings`, `GET/PATCH /api/streaks/settings` `[review_settings_handler.go:getReviewSettings]`, `[review_settings_handler.go:patchReviewSettings]`, `[review_settings_handler.go:getStreakSettings]`, `[review_settings_handler.go:patchStreakSettings]`
  - `GET /api/stats/summary` `[stats_handler.go:getStatsSummary]`
  - `GET/POST /api/decks`, `PATCH/DELETE /api/decks/{deck_id}`, `POST /api/decks/{deck_id}/move-items` `[deck_handler.go:listDecks]`, `[deck_handler.go:createDeck]`, `[deck_handler.go:renameDeck]`, `[deck_handler.go:deleteDeck]`, `[deck_handler.go:moveItems]`
  - `POST /api/notifications/register`, `GET /api/content/word-of-the-day`, `GET /api/content/challenges` `[notifications_handler.go:registerPushToken]`, `[notifications_handler.go:getWordOfTheDay]`, `[notifications_handler.go:listChallenges]`
  - `POST /api/import/anki/preview`, `POST /api/import/anki` `[import_handler.go:previewAnkiImport]`, `[import_handler.go:importAnki]`
- Analytics ingestion (when `AnalyticsEnabled && AnalyticsLogger != nil`, `optionalAuthMiddleware`): `POST /api/analytics/events` `[router.go:NewRouter]`, `[analytics_handler.go:collect]`

## Invariants
- `authMiddleware` strips spoofable client identity headers (`X-User-Subject`, `X-User-Issuer`, `X-User-Id`, `X-User-Email`, `X-User-Roles`) on every request, trusts only gateway-confirmed `v1.` session handles/cookies, dev-bypass tokens (strictly when `devBypass == true`), or JWKS-verified JWTs, and fails closed with `401 AUTH-101` `[auth_middleware.go:authMiddleware]`, `[auth_middleware.go:discardClientIdentityHeaders]`.
- `callback` validates the SHA-256 `pa_bind` digest against the `__Host-pa_nonce` cookie in constant time, clears the nonce cookie, enforces `exch.Audience == "project-pn"`, redirects unsigned-in browsers back to `publicAppURL + "/"` (`302 Found`) if gateway ticket exchange or session confirmation fails, and fails visibly (`503`) rather than redirecting as signed in if `EnsurePlatformUser` fails `[auth_handler.go:callback]`.
- Pickup codes generated on callback are single-use, 32-hex characters, expire after `30s`, and `POST /api/auth/session` caps request bodies at 4 KiB `[auth_handler.go:session]`, `[auth_handler.go:consumePickupCode]`.
- `csrfProtection` applies to cookie-authenticated sessions on mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`), requiring both an `Origin` matching `allowedOrigins` (`SEC-101`) and matching `project_pn_csrf` cookie + `X-CSRF-Token` header (`SEC-102`) `[csrf.go:csrfProtection]`.
- `analyticsHandler.collect` caps batch payloads at 256 KiB (`ANL-413`), disallows unknown JSON fields, enforces 1–100 valid events, and overwrites `AuthenticatedUserID` with the API-verified `userIDFromRequest(r)` `[analytics_handler.go:collect]`.
- `wordsHandler.recordBatchReviewAttempts` validates `activity_type` against `validReviewActivityTypes` and `rating_score` within `[0.0, 3.0]`; `listLearningItems` clamps `limit` to `1..100` `[words_handler.go:recordBatchReviewAttempts]`, `[words_handler.go:parseListLearningItemsParams]`.

## Side Effects
- Reads environment fallbacks (`PUBLIC_APP_URL`, `PUBLIC_AUTH_ORIGIN`, `CENTRAL_AUTH_URL`, `AUTH_JWT_ISSUER`) in `newAuthHandler` when explicit dependency fields are empty `[auth_handler.go:newAuthHandler]`.
- Sets and clears HTTP cookies (`__Host-pa_nonce`, `nacfson_session`, `project_pn_csrf`) and response headers (`X-Refreshed-Session-Handle`) `[auth_handler.go:login]`, `[auth_handler.go:callback]`, `[auth_handler.go:centralLogout]`, `[auth_middleware.go:authMiddleware]`, `[csrf.go:ensureCSRFToken]`.
- Maintains in-memory mutex-protected state for short-lived pickup codes (`authHandler.pickupCodes`) and sliding-window per-IP rate limits (`rateLimiter.visitors`) `[auth_handler.go:storePickupCode]`, `[ratelimit.go:allow]`.
- Invokes database pings (`/readyz`), `auth.Service`, `words.Service`, `auth.GatewayClient`, `auth.JWTVerifier`, `auth.CentralClient`, `admin.Logger`, and `analytics.Logger` `[router.go:readyz]`, `[auth_middleware.go:authMiddleware]`, `[analytics_middleware.go:analyticsRequestMiddleware]`.

## Verification
- Run: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./internal/http` (full suite: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`)
