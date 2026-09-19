# Backend Docs

Documentation for the Go + PostgreSQL backend.

| File | Purpose |
|---|---|
| [`backend-overview.md`](backend-overview.md) | Product goal, core principles, HTTP API surface, enrichment, CORS, MVP boundary |
| [`backend-schema-mvp.md`](backend-schema-mvp.md) | MVP table definitions, constraints, indexes, relationships |
| [`backend-flows.md`](backend-flows.md) | Register/login, language pairs, add-word, lookup, review, FSRS optimization flows |
| [`learning-review-model.md`](learning-review-model.md) | Learning stages, scheduling rules, FSRS, leech/bury/fuzz, attempt types |
| [`go-backend-setup.md`](go-backend-setup.md) | Local setup, migrations, environment variables, tests |
| [`backend-acceptance-tests.md`](backend-acceptance-tests.md) | Schema and HTTP acceptance scenarios |
| [`backend-future-scope.md`](backend-future-scope.md) | Tables and features intentionally out of MVP |
| [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md) | Production deploy to Oracle Cloud k3s |
| [`cursor-secrets.md`](cursor-secrets.md) | Runtime secrets via Cursor environment secrets |
| [`db-s3-migration.md`](db-s3-migration.md) | Dump/restore Postgres values through AWS S3 (PC move) |
| [`ghcr-deploy.md`](ghcr-deploy.md) | GHCR image publishing |
| [`remote-deploy-runbook.md`](remote-deploy-runbook.md) | Redirect to Oracle deploy docs |

See also [`docs/GUIDE.md`](../../docs/GUIDE.md) for the full project documentation map.
