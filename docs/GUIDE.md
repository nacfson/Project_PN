# Project PN Documentation Guide

This guide maps every documentation file in the repository. Use it to find the right doc for your task.

## For Newcomers

1. Start with [`backend/docs/backend-overview.md`](../backend/docs/backend-overview.md) to understand the product and architecture.
2. Read [`AGENTS.md`](../AGENTS.md) for agent task routing rules.
3. Follow [`backend/docs/go-backend-setup.md`](../backend/docs/go-backend-setup.md) to run the stack locally.
4. Use [`docs/dev-test-plan.md`](dev-test-plan.md) for manual QA.

## Backend Docs

| File | Purpose |
|---|---|
| [`backend-overview.md`](../backend/docs/backend-overview.md) | Product goal, core principles, HTTP API surface, enrichment, CORS, MVP boundary |
| [`backend-schema-mvp.md`](../backend/docs/backend-schema-mvp.md) | MVP table definitions, constraints, indexes, relationships |
| [`backend-flows.md`](../backend/docs/backend-flows.md) | Register/login, language pairs, add-word, lookup, review, FSRS optimization flows |
| [`learning-review-model.md`](../backend/docs/learning-review-model.md) | Learning stages, scheduling rules, FSRS, leech/bury/fuzz, attempt types |
| [`go-backend-setup.md`](../backend/docs/go-backend-setup.md) | Local setup, migrations, environment variables, tests, Docker deploy |
| [`backend-acceptance-tests.md`](../backend/docs/backend-acceptance-tests.md) | Schema and HTTP acceptance scenarios |
| [`backend-future-scope.md`](../backend/docs/backend-future-scope.md) | Tables and features intentionally out of MVP |
| [`remote-deploy-runbook.md`](../backend/docs/remote-deploy-runbook.md) | Production-style deploy to zlUbuntu |
| [`remote-access-port-forward-summary.md`](../backend/docs/remote-access-port-forward-summary.md) | Port forwarding notes |

## Frontend Docs

| File | Purpose |
|---|---|
| [`frontend-ux-patterns.md`](../frontend/docs/frontend-ux-patterns.md) | Shared Input, validation, loading states, practice UX, OAuth, platform rules, translations |
| [`ui-translation-audit-report.md`](../frontend/docs/ui-translation-audit-report.md) | Translation audit |
| [`deprecated.md`](../frontend/docs/deprecated.md) | Deprecated frontend patterns |

## Deploy Docs

| File | Purpose |
|---|---|
| [`deploy-exception-runbook.md`](../deploy/deploy-exception-runbook.md) | Common deploy failures and fixes |
| [`NETWORK_SETUP.md`](../deploy/NETWORK_SETUP.md) | Network setup notes |

## Project-Wide Docs

| File | Purpose |
|---|---|
| [`AGENTS.md`](../AGENTS.md) | Agent task routing and project rules |
| [`README.md`](../README.md) | Top-level project index |
| [`dev-test-plan.md`](dev-test-plan.md) | Local manual QA test plan |
| [`GUIDE.md`](GUIDE.md) | This file |
| [`superpowers/plans/`](superpowers/plans/) | Implementation plans |
| [`superpowers/specs/`](superpowers/specs/) | Design specs |

## Task Routing

When working on code, follow the routing rules in [`AGENTS.md`](../AGENTS.md). Key shortcuts:

| Topic | Primary doc |
|---|---|
| Backend schema / data model | [`backend/docs/backend-schema-mvp.md`](../backend/docs/backend-schema-mvp.md) |
| Spaced repetition / scheduling | [`backend/docs/learning-review-model.md`](../backend/docs/learning-review-model.md) |
| Add-word / review flows | [`backend/docs/backend-flows.md`](../backend/docs/backend-flows.md) |
| Frontend UI patterns | [`frontend/docs/frontend-ux-patterns.md`](../frontend/docs/frontend-ux-patterns.md) |
| Deploy failures | [`deploy/deploy-exception-runbook.md`](../deploy/deploy-exception-runbook.md) |

## Glossary

| Term | Meaning |
|---|---|
| FSRS | Free Spaced Repetition Scheduler |
| `user_word_senses` | A user's relationship to a specific word meaning |
| `review_states` | Scheduling state for one `user_word_senses` row |
| `review_attempts` | Append-only history of every answer |
| `learning_stage` | High-level capability label (`new`, `learning`, `recognized`, `recalled`, `usable`, `mastered`, `archived`) |
