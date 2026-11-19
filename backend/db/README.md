# backend/db

## Overview
PostgreSQL database schema and migration assets for the Project PN backend, applied automatically on API server startup or manually via `backend/cmd/migrate`.

## Subdirectories & Boundaries
- [migrations](./migrations/README.md) - Versioned `golang-migrate` PostgreSQL `.up.sql` and `.down.sql` migrations (`000001`–`000029`) defining the global dictionary, user learning/FSRS scheduling tables, decks, push notifications, and platform identity bindings.
