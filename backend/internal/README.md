# Backend Internal Packages

## Overview
Internal Go packages implementing the Project PN backend API, authentication and identity provisioning, PostgreSQL pooling and migrations, vocabulary/FSRS domain logic, dictionary enrichment, push notifications, and structured logging/observability.

## Subdirectories & Boundaries
- [admin](./admin/README.md) - JSON admin audit logger, rolling HTTP metrics collector, and 5xx/latency Chi middleware.
- [analytics](./analytics/README.md) - Versioned append-only product analytics event schema, credential-scrubbing validator, and stdout JSON emitter.
- [auth](./auth/README.md) - Keycloak JWKS JWT verification, platform gateway client, `(issuer, subject)` user provisioning, ordinary learner capabilities, user language preferences, and account merging.
- [config](./config/README.md) - Environment-variable configuration loader for server, database, enrichment, language, CORS, auth, notifications, and logging settings.
- [db](./db/README.md) - `pgxpool` PostgreSQL connection pool configuration with lifetime caps below the `vault-db-proxy` 15-minute cutoff.
- [enrich](./enrich/README.md) - Dictionary sense enrichment and translation providers (`WiktAPI`, `OpenAIEnricher`, `FallbackEnricher`) plus gloss simplification and deduplication filters.
- [http](./http/README.md) - Chi HTTP router, auth/CSRF/CORS/rate-limit middleware, and REST handlers for all backend endpoints.
- [httpx](./httpx/README.md) - W3C `traceparent` parsing, trace ID generation, request-scoped logger context, and Contract v3 HTTP access logging middleware.
- [learninglog](./learninglog/README.md) - Logfmt encoder and daily UTC append-only file logger for domain learning events.
- [logx](./logx/README.md) - Contract v3 JSON `slog` handler with service metadata, trace ID injection, innermost error unwrapping, and 8 KiB stacktrace truncation.
- [migrations](./migrations/README.md) - `golang-migrate` wrapper for applying, rolling back, and inspecting PostgreSQL schema migrations.
- [notify](./notify/README.md) - Expo Push API client and periodic background worker for re-engagement notifications.
- [words](./words/README.md) - Vocabulary catalog caching, personal learning items, FSRS v4 spaced-repetition scheduling/optimization, decks, streaks, stats, Anki import, notifications, and sense retranslation.
