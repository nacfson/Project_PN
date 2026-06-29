# Project PN Documentation Index and Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a top-level project index (`README.md`) and a documentation navigation guide (`docs/GUIDE.md`) so new contributors and agents can locate the right document without searching the tree.

**Architecture:** One root `README.md` with a concise project summary, quick-start, and doc-map table; one `docs/GUIDE.md` with audience-based pathways and a full inventory of backend, frontend, deploy, and project-wide docs; small per-directory `README.md` files in `docs/`, `backend/docs/`, `frontend/docs/`, and `deploy/` that link back to `docs/GUIDE.md`.

**Tech Stack:** Markdown only. No code, no dependencies, no build step.

## Global Constraints

- Every doc file uses title-case H1 headings.
- All internal links use relative paths from the file's location (e.g., `backend/docs/backend-overview.md` from root, `backend-overview.md` from `backend/docs/`).
- Do not duplicate content that already exists in another doc; link instead.
- Keep `README.md` under 120 lines so it stays scannable.
- Keep `docs/GUIDE.md` under 250 lines.
- Match the concise, directive tone of existing docs.
- Do not modify the meaning of any existing doc; only add navigation.
- If a link target does not exist, do not invent it.

---

### Task 1: Audit existing documentation

**Files:**
- Create: `docs/superpowers/artifacts/doc-inventory.md`
- Test: read-back of the inventory file

**Interfaces:**
- Consumes: existing `.md` files under `backend/docs/`, `frontend/docs/`, `deploy/`, `docs/`, and `AGENTS.md`
- Produces: a scratch inventory used to decide what belongs in the index and guide

- [ ] **Step 1: List every project doc with a one-line purpose**

  Run:

  ```bash
  find backend/docs frontend/docs deploy docs AGENTS.md -type f -name '*.md' | sort
  ```

  Create `docs/superpowers/artifacts/doc-inventory.md` with this content:

  ```markdown
  # Documentation Inventory

  ## Backend
  - backend/docs/backend-overview.md — product goal, API surface, MVP boundary
  - backend/docs/backend-schema-mvp.md — table definitions, constraints, indexes
  - backend/docs/backend-flows.md — auth, add-word, lookup, review, FSRS flows
  - backend/docs/learning-review-model.md — learning stages, scheduling, attempts
  - backend/docs/go-backend-setup.md — local setup, migrations, env vars, tests
  - backend/docs/backend-acceptance-tests.md — schema and HTTP acceptance scenarios
  - backend/docs/backend-future-scope.md — future tables and features
  - backend/docs/remote-deploy-runbook.md — production deploy to zlUbuntu
  - backend/docs/remote-access-port-forward-summary.md — port forwarding notes

  ## Frontend
  - frontend/docs/frontend-ux-patterns.md — shared Input, validation, practice UX, platform rules
  - frontend/docs/ui-translation-audit-report.md — translation audit
  - frontend/docs/deprecated.md — deprecated patterns

  ## Deploy
  - deploy/deploy-exception-runbook.md — common failures and fixes
  - deploy/NETWORK_SETUP.md — network setup notes

  ## Project-wide
  - AGENTS.md — agent task routing and project rules
  - docs/dev-test-plan.md — local manual QA test plan
  - docs/superpowers/plans/*.md — implementation plans
  - docs/superpowers/specs/*.md — design specs
  ```

- [ ] **Step 2: Verify the inventory is complete**

  Run:

  ```bash
  cat docs/superpowers/artifacts/doc-inventory.md
  ```

  Expected: the file contains the lists above and no invented files.

- [ ] **Step 3: Commit**

  ```bash
  git add docs/superpowers/artifacts/doc-inventory.md
  git commit -m "docs: add documentation inventory artifact"
  ```

---

### Task 2: Create root README.md

**Files:**
- Create: `README.md`
- Test: read-back of `README.md`

**Interfaces:**
- Consumes: inventory from Task 1 and `backend/docs/backend-overview.md`
- Produces: the top-level project index that every visitor sees first

- [ ] **Step 1: Draft the empty file with the planned headings**

  Create `README.md` with exactly this content (it is the final content):

  ```markdown
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
  ```

- [ ] **Step 2: Verify the file renders and links are relative**

  Run:

  ```bash
  wc -l README.md
  head -n 20 README.md
  ```

  Expected:
  - `README.md` has fewer than 120 lines.
  - The first heading is `# Project PN`.
  - All internal links use relative paths from the repo root.

- [ ] **Step 3: Commit**

  ```bash
  git add README.md
  git commit -m "docs: add root README with quickstart and doc map"
  ```

---

### Task 3: Create docs/GUIDE.md

**Files:**
- Create: `docs/GUIDE.md`
- Test: read-back of `docs/GUIDE.md`

**Interfaces:**
- Consumes: inventory from Task 1 and routing rules from `AGENTS.md`
- Produces: the single source of truth for finding documentation by topic

- [ ] **Step 1: Write the guide content**

  Create `docs/GUIDE.md` with exactly this content:

  ```markdown
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
  ```

- [ ] **Step 2: Verify headings, line count, and link relativity**

  Run:

  ```bash
  wc -l docs/GUIDE.md
  grep -n '^# ' docs/GUIDE.md
  grep -n '\[.*\](\.*' docs/GUIDE.md | head -n 20
  ```

  Expected:
  - `docs/GUIDE.md` has fewer than 250 lines.
  - First heading is `# Project PN Documentation Guide`.
  - Links use relative paths (`../` or `./` or bare filenames), not absolute paths.

- [ ] **Step 3: Commit**

  ```bash
  git add docs/GUIDE.md
  git commit -m "docs: add project documentation navigation guide"
  ```

---

### Task 4: Create docs/README.md

**Files:**
- Create: `docs/README.md`
- Test: read-back of `docs/README.md`

**Interfaces:**
- Consumes: `docs/GUIDE.md` from Task 3
- Produces: a small landing page for the `docs/` directory

- [ ] **Step 1: Write the directory index**

  Create `docs/README.md` with exactly this content:

  ```markdown
  # Project PN Docs

  This directory holds project-wide documentation.

  - [`GUIDE.md`](GUIDE.md) — navigate all docs by topic
  - [`dev-test-plan.md`](dev-test-plan.md) — local manual QA test plan
  - [`superpowers/plans/`](superpowers/plans/) — implementation plans
  - [`superpowers/specs/`](superpowers/specs/) — design specs
  ```

- [ ] **Step 2: Verify the file**

  Run:

  ```bash
  cat docs/README.md
  ```

  Expected: the file matches the content above, with four bullet links.

- [ ] **Step 3: Commit**

  ```bash
  git add docs/README.md
  git commit -m "docs: add docs directory README"
  ```

---

### Task 5: Create backend/docs/README.md

**Files:**
- Create: `backend/docs/README.md`
- Test: read-back of `backend/docs/README.md`

**Interfaces:**
- Consumes: inventory from Task 1 and `docs/GUIDE.md` from Task 3
- Produces: a landing page for backend docs

- [ ] **Step 1: Write the backend docs index**

  Create `backend/docs/README.md` with exactly this content:

  ```markdown
  # Backend Docs

  Documentation for the Go + PostgreSQL backend.

  | File | Purpose |
  |---|---|
  | [`backend-overview.md`](backend-overview.md) | Product goal, core principles, HTTP API surface, enrichment, CORS, MVP boundary |
  | [`backend-schema-mvp.md`](backend-schema-mvp.md) | MVP table definitions, constraints, indexes, relationships |
  | [`backend-flows.md`](backend-flows.md) | Register/login, language pairs, add-word, lookup, review, FSRS optimization flows |
  | [`learning-review-model.md`](learning-review-model.md) | Learning stages, scheduling rules, FSRS, leech/bury/fuzz, attempt types |
  | [`go-backend-setup.md`](go-backend-setup.md) | Local setup, migrations, environment variables, tests, Docker deploy |
  | [`backend-acceptance-tests.md`](backend-acceptance-tests.md) | Schema and HTTP acceptance scenarios |
  | [`backend-future-scope.md`](backend-future-scope.md) | Tables and features intentionally out of MVP |
  | [`remote-deploy-runbook.md`](remote-deploy-runbook.md) | Production-style deploy to zlUbuntu |
  | [`remote-access-port-forward-summary.md`](remote-access-port-forward-summary.md) | Port forwarding notes |

  See also [`docs/GUIDE.md`](../../docs/GUIDE.md) for the full project documentation map.
  ```

- [ ] **Step 2: Verify the file**

  Run:

  ```bash
  cat backend/docs/README.md
  ```

  Expected: the file contains the table above and a link to `docs/GUIDE.md`.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/docs/README.md
  git commit -m "docs: add backend docs README"
  ```

---

### Task 6: Create frontend/docs/README.md

**Files:**
- Create: `frontend/docs/README.md`
- Test: read-back of `frontend/docs/README.md`

**Interfaces:**
- Consumes: inventory from Task 1 and `docs/GUIDE.md` from Task 3
- Produces: a landing page for frontend docs

- [ ] **Step 1: Write the frontend docs index**

  Create `frontend/docs/README.md` with exactly this content:

  ```markdown
  # Frontend Docs

  Documentation for the React Native / Expo / Tauri frontend.

  | File | Purpose |
  |---|---|
  | [`frontend-ux-patterns.md`](frontend-ux-patterns.md) | Shared Input, validation, loading states, practice UX, OAuth, platform rules, translations |
  | [`ui-translation-audit-report.md`](ui-translation-audit-report.md) | Translation audit |
  | [`deprecated.md`](deprecated.md) | Deprecated frontend patterns |

  See also [`docs/GUIDE.md`](../../docs/GUIDE.md) for the full project documentation map.
  ```

- [ ] **Step 2: Verify the file**

  Run:

  ```bash
  cat frontend/docs/README.md
  ```

  Expected: the file contains the table above and a link to `docs/GUIDE.md`.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/docs/README.md
  git commit -m "docs: add frontend docs README"
  ```

---

### Task 7: Create deploy/README.md

**Files:**
- Create: `deploy/README.md`
- Test: read-back of `deploy/README.md`

**Interfaces:**
- Consumes: inventory from Task 1 and `docs/GUIDE.md` from Task 3
- Produces: a landing page for deploy docs

- [ ] **Step 1: Write the deploy docs index**

  Create `deploy/README.md` with exactly this content:

  ```markdown
  # Deploy Docs

  Documentation for deploying Project PN.

  | File | Purpose |
  |---|---|
  | [`deploy-exception-runbook.md`](deploy-exception-runbook.md) | Common deploy failures and fixes |
  | [`NETWORK_SETUP.md`](NETWORK_SETUP.md) | Network setup notes |

  For the full deploy procedure, see [`backend/docs/remote-deploy-runbook.md`](../backend/docs/remote-deploy-runbook.md).

  See also [`docs/GUIDE.md`](../docs/GUIDE.md) for the full project documentation map.
  ```

- [ ] **Step 2: Verify the file**

  Run:

  ```bash
  cat deploy/README.md
  ```

  Expected: the file contains the table above, a link to the backend deploy runbook, and a link to `docs/GUIDE.md`.

- [ ] **Step 3: Commit**

  ```bash
  git add deploy/README.md
  git commit -m "docs: add deploy docs README"
  ```

---

### Task 8: Verify all internal links

**Files:**
- Modify: none (read-only verification)
- Test: link list and spot checks

**Interfaces:**
- Consumes: all files created in Tasks 2–7
- Produces: a verified list of internal markdown links

- [ ] **Step 1: Extract every internal markdown link**

  Run:

  ```bash
  grep -rhoE '\[([^]]+)\]\(([^)]+)\)' README.md docs/GUIDE.md docs/README.md backend/docs/README.md frontend/docs/README.md deploy/README.md | sort | uniq
  ```

  Expected output includes these targets (and no broken relative paths):

  ```text
  [AGENTS.md](../AGENTS.md)
  [AGENTS.md](../AGENTS.md)
  [README.md](../README.md)
  [GUIDE.md](GUIDE.md)
  [GUIDE.md](../../docs/GUIDE.md)
  [GUIDE.md](../docs/GUIDE.md)
  [backend/docs/backend-flows.md](backend-flows.md)
  [backend/docs/backend-flows.md](../backend/docs/backend-flows.md)
  [backend/docs/backend-overview.md](../backend/docs/backend-overview.md)
  [backend/docs/backend-overview.md](backend-overview.md)
  ... (remaining links)
  ```

- [ ] **Step 2: Spot-check each file resolves from its source**

  Run:

  ```bash
  test -f README.md
  test -f docs/GUIDE.md
  test -f docs/README.md
  test -f backend/docs/README.md
  test -f frontend/docs/README.md
  test -f deploy/README.md
  echo "all new files exist"
  ```

  Expected:

  ```text
  all new files exist
  ```

- [ ] **Step 3: Commit verification artifact (optional)**

  If you generated a link list file, add and commit it:

  ```bash
  git add docs/superpowers/artifacts/doc-internal-links.md
  git commit -m "docs: add internal link verification artifact"
  ```

  Otherwise, this task has no file changes to commit.

---

## Self-Review

**1. Spec coverage:** Every planned deliverable maps to a task:
- Root index → Task 2 (`README.md`)
- Navigation guide → Task 3 (`docs/GUIDE.md`)
- Per-directory indexes → Tasks 4–7 (`docs/README.md`, `backend/docs/README.md`, `frontend/docs/README.md`, `deploy/README.md`)
- Link verification → Task 8

**2. Placeholder scan:** No `TBD`, `TODO`, `implement later`, or vague instructions. Each task contains the exact file content.

**3. Type consistency:** All relative paths are consistent with each source file's location. Root links use `backend/docs/...`; `docs/GUIDE.md` uses `../backend/docs/...`; subdirectory indexes use bare filenames or `../../docs/GUIDE.md`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-26-project-index-and-guide.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
