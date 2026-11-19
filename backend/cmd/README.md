# backend/cmd

## Overview
Go executable entrypoints (`package main`) for the Project PN backend, separating the long-running HTTP API server from database migration and vocabulary maintenance CLIs.

## Subdirectories & Boundaries
- [api](./api/README.md) - Main HTTP API server (`pn-api`) with startup migrations, auth/enrichment wiring, metrics flushing, and optional Expo push notification worker.
- [import-examples](./import-examples/README.md) - Bulk TSV importer CLI for attaching example sentences and translations to existing word senses.
- [migrate](./migrate/README.md) - Standalone PostgreSQL schema migration runner supporting `up`, `down`, and `version`.
- [retranslate-senses](./retranslate-senses/README.md) - Batch CLI utility for previewing or re-translating word senses via the configured gloss enrichment pipeline.
