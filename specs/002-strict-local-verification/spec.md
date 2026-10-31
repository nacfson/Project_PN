# Feature Specification: Strict Verification System & Local Stack Connectivity Fix

**Feature Branch**: `002-strict-local-verification`

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "We have to make a verification system should be more restrict and make a fix creation spec too for this issue."

## Background

The frontend could not reach the backend because nothing in the local stack was running (API, database, web client), local environment files were absent, and the client silently fell back to a dead local address. No existing check noticed this: the only automated checks are an import-path lint and image publishing workflows. Tests, type checks, and the constitution's pre-merge checklist are not enforced by any hook or pipeline, and nothing verifies that the client and server can actually talk to each other.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-command local readiness verification (Priority: P1)

A developer (or AI agent) runs a single verification command before declaring work done. It reports precisely which part of the local stack is unhealthy (database, backend, web client, environment configuration, client-to-backend connectivity) and fails with a non-zero result if any part is not ready.

**Why this priority**: This directly prevents the reported incident: a broken or unreachable stack being treated as "fine".

**Independent Test**: With the stack fully stopped, run the command and confirm it fails and names each missing component. Start the stack and confirm it passes.

**Acceptance Scenarios**:

1. **Given** the backend, database, and web client are all stopped, **When** the verification command runs, **Then** it fails and lists each unreachable component with a remediation hint.
2. **Given** local environment files are missing, **When** the command runs, **Then** it fails and identifies which files are missing.
3. **Given** everything is running and healthy, **When** the command runs, **Then** it passes, including an authenticated request from the client's configured address to the backend.
4. **Given** the backend is up but the database is unreachable, **When** the command runs, **Then** it fails and distinguishes "backend alive" from "backend ready".

---

### User Story 2 - Mandatory quality gates before merge (Priority: P1)

Every change to be merged is automatically checked against the constitution's pre-merge checklist: serial backend tests, frontend tests, type checks for the frontend and shared API package, import lint, and the Add-tab Manual-first invariant. A failing gate blocks the merge and image publishing.

**Why this priority**: Today none of these are enforced, so regressions pass silently.

**Independent Test**: Open a change that deliberately breaks a frontend type, a backend test, or the Manual-first invariant, and confirm each is blocked with a clear failure reason.

**Acceptance Scenarios**:

1. **Given** a change that breaks a backend test, **When** the gates run, **Then** the change is blocked.
2. **Given** a change that breaks a type check, **When** the gates run, **Then** the change is blocked.
3. **Given** a change that makes the Add tab default anything other than Manual, **When** the gates run, **Then** the change is blocked.
4. **Given** all gates pass, **When** the change is merged to the main line, **Then** image publishing proceeds; if any gate fails, publishing does not run.

---

### User Story 3 - Local pre-push enforcement (Priority: P2)

Before changes leave a developer's machine, the fast subset of the gates (lint, type checks, frontend tests) runs automatically and blocks the push on failure. There is no way to skip or bypass these checks.

**Why this priority**: Gives feedback earlier than the shared pipeline, but the shared pipeline is the authoritative backstop.

**Independent Test**: Introduce a type error, attempt a push, and confirm it is blocked locally.

**Acceptance Scenarios**:

1. **Given** a type error in the working tree, **When** the developer pushes, **Then** the push is blocked with the failing check shown.
2. **Given** all fast checks pass, **When** the developer pushes, **Then** the push proceeds without noticeable delay beyond the checks.

---

### User Story 4 - Fix: client fails loudly when backend is unreachable (Priority: P2)

When the web client cannot reach its backend in local development, the developer sees an explicit, actionable message (which address was tried, and that the backend appears to be down) instead of silent failures. Setup guidance makes first-time startup (environment files, database, migrations, API, client) reproducible and corrects known-broken startup paths.

**Why this priority**: Addresses the user-facing symptom of the original incident and shortens recovery time.

**Independent Test**: Start only the web client, load it, and confirm a clear "backend unreachable" message naming the attempted address appears in development.

**Acceptance Scenarios**:

1. **Given** the backend is stopped, **When** the client loads in development, **Then** a clear unreachable-backend message with the attempted address and a hint to run the verification command is shown.
2. **Given** a fresh checkout, **When** the developer follows the documented startup steps, **Then** the full stack comes up and the verification command passes without undocumented manual fixes.
3. **Given** the documented one-shot startup script has a known failing step, **When** the fix is applied, **Then** the script either completes successfully or is removed from the guidance.

---

### Edge Cases

- Port already in use by an unrelated process: verification reports a conflict rather than a false pass.
- Backend healthy but returns authentication failures: verification reports an auth problem separately from connectivity.
- Database tests run in parallel against the shared database: gates must run them serially to avoid false failures.
- Verification run in an environment without the database container runtime: reports the missing prerequisite rather than crashing.
- Developer attempts to skip the checks (e.g., disabling the hook or forcing the push): the shared pipeline still runs every gate and blocks the change, so skipping locally gains nothing.
- Environment-specific overrides pointing the client at a hosted address: verification checks the address actually configured, not an assumed default.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single local command that verifies environment files, database reachability, backend liveness and readiness, web client availability, and authenticated client-to-backend connectivity.
- **FR-002**: The local command MUST exit non-zero if any check fails and MUST report each failing check separately with a remediation hint.
- **FR-003**: The local command MUST clearly distinguish backend "alive" from backend "ready (database connected)".
- **FR-004**: The system MUST run, on every proposed change, backend tests executed serially, frontend tests, frontend and shared API type checks, import lint, and the Add-tab Manual-first invariant check.
- **FR-005**: A failing gate MUST block merge to the main line.
- **FR-006**: Image publishing MUST NOT proceed unless all gates pass.
- **FR-007**: The system MUST run a fast subset of the checks automatically before a push and block it on failure.
- **FR-008**: No bypass, override, or skip option MAY be provided for any gate, locally or in the shared pipeline. Any attempt to circumvent local checks MUST still be caught and blocked by the shared pipeline.
- **FR-009**: The system MUST include an automated end-to-end integration check that runs the real backend and exercises the client's API access layer against it, failing when a response or request shape the client relies on no longer matches the backend. No separate schema document or code-generation pipeline is required.
- **FR-010**: In development, the web client MUST display an explicit unreachable-backend message including the attempted address when its backend cannot be reached.
- **FR-011**: Local startup documentation MUST describe a reproducible, ordered startup sequence and MUST NOT reference startup paths known to fail.
- **FR-012**: The verification outputs MUST be understandable without reading source code (plain-language pass/fail summary).

### Key Entities

- **Verification Check**: A single named assertion about the stack or the code (e.g., database reachable, type check clean) with a pass/fail result and remediation hint.
- **Quality Gate**: A required group of checks that must pass before merge or publish.
- **Verification Report**: The summarized, per-check outcome presented to the developer or recorded by the pipeline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With any single stack component stopped, the local verification fails 100% of the time and names the failing component.
- **SC-002**: A developer can identify the cause of a stack outage from the verification report in under 1 minute.
- **SC-003**: 100% of changes merged to the main line have passed all quality gates.
- **SC-004**: Deliberately introduced regressions (failing test, type error, broken Manual-first invariant, contract mismatch) are blocked 100% of the time in trial runs.
- **SC-005**: A fresh checkout reaches a fully passing verification by following documented steps alone, in under 15 minutes.
- **SC-006**: The fast pre-push checks complete in under 2 minutes on a typical development machine.

## Assumptions

- The constitution's pre-merge checklist (serial backend tests, frontend tests, type checks, Manual-first invariant) is the authoritative definition of the required gates.
- The shared pipeline is the authoritative enforcement point; local hooks give early feedback only. No gate can be skipped by a developer.
- Database-backed checks require a local database to be available and are expected to run in the pipeline with a provisioned database.
- The fix covers development-time connectivity feedback and setup guidance; it does not change production deployment, authentication behavior, or the backend schema.
- The development sign-in shortcut used for local verification is acceptable for local checks only and is never used against production.
- Force-pushing to the main line is not currently blocked, because the `main_PR` ruleset is disabled. Requiring the quality gates to pass before merge is a separate setting and is in scope for this feature (FR-005), which stays unmet until that setting is enabled.
