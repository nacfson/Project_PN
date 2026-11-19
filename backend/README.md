# Backend

## Overview
Go 1.26 + PostgreSQL vocabulary-learning backend module (`go.mod`) for Project PN. Enforces the core separation between global dictionary data (`words`, `word_senses`, `sense_translations`, `examples`) and personal learning progress (`user_word_senses`, `review_states`, append-only `review_attempts`), with Keycloak/gateway JWT authentication, WiktApi + fallback gloss enrichment, FSRS v4 scheduling, and Expo push notifications.

## Subdirectories & Boundaries
- [cmd](./cmd/README.md) - Executable Go entrypoints (`api` HTTP server, `migrate`, `import-examples`, and `retranslate-senses` CLIs).
- [db](./db/README.md) - Versioned PostgreSQL `golang-migrate` SQL schema and data migrations (`000001`–`000029`).
- [internal](./internal/README.md) - Internal packages for HTTP routing/middleware, auth/identity provisioning, `pgxpool` connection lifecycle, enrichment, FSRS words service, push notifications, and Contract v3 logging/analytics.
