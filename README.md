# Project PN

Personal vocabulary learning system. Add words you do not know, study them with spaced repetition, and track your memory — not just your streak.

## Tech Stack

- **Backend**: Go, PostgreSQL, Docker Compose
- **Frontend**: React Native / Expo with TypeScript (Web, iOS, Android), Tauri for desktop
- **Deploy**: Docker Compose on Ubuntu, nginx

## Quick Start

```sh
scripts/start-web-dev.sh
```

Then open `http://localhost:8081`.

For local backend setup details, see [`backend/docs/go-backend-setup.md`](backend/docs/go-backend-setup.md).

## Documentation

| If you want to... | Read this |
|---|---|
| Understand the product and backend API | [`backend/docs/backend-overview.md`](backend/docs/backend-overview.md) |
| Set up the local backend | [`backend/docs/go-backend-setup.md`](backend/docs/go-backend-setup.md) |
| Learn frontend UX patterns | [`frontend/docs/frontend-ux-patterns.md`](frontend/docs/frontend-ux-patterns.md) |
| Deploy to zlUbuntu | [`backend/docs/remote-deploy-runbook.md`](backend/docs/remote-deploy-runbook.md) |
| Fix deploy issues | [`deploy/deploy-exception-runbook.md`](deploy/deploy-exception-runbook.md) |
| Run manual QA locally | [`docs/dev-test-plan.md`](docs/dev-test-plan.md) |
| Navigate all docs | [`docs/GUIDE.md`](docs/GUIDE.md) |

## Project Structure

```text
backend/   Go API, migrations, backend docs
frontend/  React Native / Expo app, Tauri desktop wrapper
deploy/    Docker Compose, nginx, deploy scripts
docs/      Project-wide docs and plans
scripts/   Development and deployment helpers
```

## Core Principle

> A word is global, but memory is personal.

The learnable unit is `user_word_senses`, not `user_words`. See [`backend/docs/backend-overview.md`](backend/docs/backend-overview.md) for details.
