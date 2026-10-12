<!--
# Sync Impact Report
- Version change: 1.1.0 → 1.1.1 (PATCH)
- Modified:
  - Identity & Authentication — no application-admin role in product; remove ProcessManager as auth authority; access-token-only for project audience; keep ordinary learner + cross-user deny
- Prior 1.1.0: central-auth → platform Keycloak JWT; `(issuer, subject)`; Google live / expand later; operator migration
- Follow-up TODOs: Implement 001-gateway-jwt-auth cleanup tasks (code + docs)
-->

# Project PN Constitution

## Core Principles

### I. Sense-Level Learning ("A Word is Global, Memory is Personal")
The learnable unit MUST be `user_word_senses`, never `user_words`.
- Global dictionary information belongs strictly in shared `words` and `word_senses` tables.
- User progress, mastery, intervals, notes, and study metrics MUST be stored only in user-scoped tables (`user_word_senses`, `review_states`, `review_attempts`).
- User-specific learning data MUST NOT be stored on global dictionary entities, nor may `user_words` be reintroduced as the primary learning entity.
*Rationale*: Words frequently have multiple distinct senses (e.g., `charge`). A learner may know one sense but not another; tracking progress per word distorts spaced repetition scheduling and invalidates memory evaluation.

### II. Spaced Repetition & Attempt Immutability
Spaced repetition scheduling MUST rely on `review_states.due_at` as the single source of truth.
- Review scheduling adheres strictly to FSRS v4 scheduling algorithms with Anki-aligned learning/relearning steps, daily deck limits, interval fuzzing, leech detection, and sibling-sense burying.
- The `review_attempts` table MUST remain an append-only event log. Past attempts MUST NEVER be updated or deleted.
- FSRS weight optimizations MUST only derive from immutable historical review attempts.
*Rationale*: Predictive spaced repetition accuracy and algorithmic optimization require a tamper-proof historical log of active recall performance.

### III. Lean MVP Schema & Architecture Isolation
The core domain model MUST strictly adhere to the lean MVP schema (`users`, `words`, `word_senses`, `user_word_senses`, `review_states`, `review_attempts`, `examples`).
- Future expansion tables and workflows (such as advanced study sessions, decks/collections, tags, AI writing/speaking evaluators) MUST NOT be introduced without explicit scope expansion approval.
- Primary database target MUST be local PostgreSQL using `pgcrypto` UUID primary keys and declarative database constraints (foreign keys, check constraints, unique indexes).
- No proprietary BaaS vendor locks (no Supabase Auth/RLS, no Firebase Auth, no client-direct database access). Authentication for protected APIs MUST use `Authorization: Bearer <token>` where the production credential is a **platform-issued project access JWT** verified by Project PN (signature, issuer, audience, expiry, subject). Identity bindings and learning ownership remain in Project PN’s database.
*Rationale*: Protecting the MVP boundary keeps the system lightweight, portable, verifiable, and free of vendor lock-in.

### IV. Cross-Platform Consistency & Product UI Invariants
The frontend is a single multiplatform client (React Native / Expo with TypeScript for Web, iOS, Android, and desktop via Tauri).
- Client interfaces in `frontend/src/types` MUST mirror backend DTO structs exactly. Data fetching MUST be centralized in `frontend/src/api/` repository modules rather than scattered inline across components.
- Product Lock / Add-Tab Invariant: `AddScreen` default `activeTab` MUST be `'manual'`. The Manual segment MUST be the first option in the tab switcher, and the Manual Add input MUST be visible on initial paint when a deck is selected without requiring extra user interaction.
- UI components MUST use standard responsive flexbox, shared reusable input primitives, non-destructive undo patterns, and bilingual translation support (`en` and `ko`).
*Rationale*: Preserving consistent cross-platform ergonomics and protecting core user workflows from inadvertent regressions is critical to learner habit retention.

### V. Rigorous Testing & Serial Execution Discipline
All backend and frontend changes MUST pass automated test suites and static type verification prior to merge.
- Backend integration tests MUST be executed serially (`cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`). Parallel test execution against shared PostgreSQL test environments is strictly forbidden due to table truncation race conditions.
- Frontend test suites (`npm test -w frontend`) and type checking (`npm run typecheck -w frontend`) MUST pass cleanly. Add-screen unit tests (`AddScreen.test.tsx`) MUST continuously assert Manual-first invariant compliance.
- Backend and frontend contract changes MUST be verified end-to-end to prevent API drift.
*Rationale*: Truncation deadlocks in parallel test runs lead to false-negative build failures, while strict automated testing ensures multiplatform client stability.

## Technical Constraints & Security Standards
- **Identity & Authentication**: Browser login, Google (and future brokers such as Apple/Email), SSO session lifetime, and token refresh are **platform-owned** (Traefik ForwardAuth + gateway + Keycloak). ProcessManager MUST NOT be treated as Project PN’s authentication authority. Project PN MUST independently verify each inbound **project-scoped access JWT** (JWKS, issuer, audience = this project, algorithm allowlist, time claims, subject) and MUST reject ID tokens and other non-access credentials; MUST NOT trust gateway identity headers alone. Durable platform identity inside Project PN is the pair `(issuer, subject)`; email is informational only and MUST NOT be the permanent unique account key. Sign-in method (`google` live for current delivery; schema MAY reserve `apple` / `email` for later expansion) is metadata on the identity binding. Existing local `users` and learning data MUST be preserved across IdP cutover; binding existing accounts to Keycloak identities is via **operator migration**. Verified identities receive **ordinary** learner capabilities only; there is **no application-administrator product role** (no admin bindings / `is_admin` product authorization). Cross-user private learning data MUST be denied. Project PN MUST NOT implement a bypass browser OIDC/Google login path that skips the platform gateway. Legacy central-auth session validation and ProcessManager auth remnants MUST NOT remain as production auth paths after cutover.
- **Dictionary Origin & Enrichment**: Primary gloss resolution uses public WiktApi (`api.wiktapi.dev`) with CC BY-SA attribution. Optional AI enrichment (Gemini/OpenAI-compatible) serves solely as a secondary fallback on cache and WiktApi miss, guarded by environment configuration.
- **Production Infrastructure & Secrets**: Production runs on Oracle Cloud k3s (arm64 architecture). Sensitive runtime credentials (database passwords, OAuth secrets, enrichment API keys, JWT issuer/audience/JWKS settings) MUST NEVER be committed to repository files and MUST be managed via environment secrets.

## Development Workflow & Quality Gates
- **Task Routing Adherence**: Before modifying code, developers and AI agents MUST consult the task routing matrix in `AGENTS.md` / `GEMINI.md` and review corresponding architectural documents.
- **Pre-Commit / Pre-Merge Checklist**:
  1. Rebase cleanly onto the latest `main` branch.
  2. Execute local stack verification: `npm run verify` (stack health) or `npm run verify:full` (full static analysis, frontend/contract tests, and serial backend tests).
  3. Execute backend test suite serially: `cd backend && GOTOOLCHAIN=go1.26.0 go test -p 1 ./...`.
  4. Execute frontend test suite: `npm test -w frontend`.
  5. Verify AddScreen invariant: assert Manual-first tab is default in `AddScreen.tsx` and passing in `AddScreen.test.tsx`.
  6. Validate type safety: `npm run typecheck -w frontend` and `npm run typecheck -w packages/api`.
  7. Automated Quality Gates: All mandatory CI quality gate jobs in `.github/workflows/quality-gates.yml` (`static`, `frontend-tests`, `add-tab-invariant`, `backend-tests`, `contract-e2e`) MUST pass without bypass or skip options before merge or container image publishing.
- **Safety Policy**: No destructive operations (dropping tables, force pushing to main, deleting migrations) are permitted without explicit user authorization.

## Governance
- **Constitutional Supremacy**: This constitution is the supreme authority for Project PN architecture, database schema, and operational standards. All code changes, documentation, and agent behaviors MUST comply.
- **Amendment Procedure**: Amendments to this constitution require:
  1. A clear statement of rationale and impact assessment.
  2. Compatibility analysis for database schema, API contracts, and user data.
  3. Semantic versioning increment and date updates in this file.
- **Versioning Policy**:
  - `MAJOR`: Breaking changes to fundamental principles (e.g., altering sense-level architecture, abandoning serial test discipline) or core governance structure.
  - `MINOR`: Addition of new principles, new operational constraints, or substantial enhancements to existing rules.
  - `PATCH`: Non-semantic clarifications, typographical corrections, or formatting adjustments.
- **Compliance & Review Expectations**: Every pull request, automated agent contribution, and code review MUST explicitly verify compliance with this constitution. PRs introducing architectural regression or violating invariants MUST be blocked until aligned.
- **Operational Procedures**: Runtime runbooks, setup guidelines, and detailed API documentation in `backend/docs/` and `docs/` serve as secondary guidance conforming strictly to these constitutional principles.

**Version**: 1.1.2 | **Ratified**: 2026-06-13 | **Last Amended**: 2026-10-11
