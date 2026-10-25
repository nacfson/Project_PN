# Cloud-Only Container Image Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Project PN container image builds (`project-pn-backend` and `project-pn-frontend`) exclusively to GitHub Actions cloud sessions with native Go cross-compilation, BuildKit layer caching, aligned Traefik ForwardAuth frontend export, and a pure `gh workflow run` cloud dispatcher in `scripts/push-ghcr.sh`.

**Architecture:** `backend/Dockerfile` switches its builder stage to `FROM --platform=$BUILDPLATFORM golang:1.26 AS builder` and cross-compiles `api`, `migrate`, and `retranslate-senses` using `GOOS=${TARGETOS} GOARCH=${TARGETARCH}`, avoiding QEMU emulation during compilation. `.github/workflows/publish-ghcr-images.yml` becomes the single canonical cloud builder (removing redundant `.github/workflows/publish-backend.yml`, removing stale `EXPO_PUBLIC_CENTRAL_AUTH_URL`, adding a `workflow_dispatch` `target` selector, and enabling scoped GHA BuildKit caching and OCI index annotations). `scripts/push-ghcr.sh` is replaced with a pure GitHub CLI (`gh workflow run`) cloud-session dispatcher (no local `docker buildx` or local `npm run web:export`), and all runbooks/skills are updated accordingly.

**Tech Stack:** Docker Buildx / BuildKit (`backend/Dockerfile`, `frontend/Dockerfile.web`), GitHub Actions (`.github/workflows/publish-ghcr-images.yml`), Bash + GitHub CLI (`scripts/push-ghcr.sh`).

**Spec:** `docs/superpowers/specs/2026-10-24-cloud-image-builds-design.md`

## Global Constraints

- Preserve the `spec 002` quality gate contract: `publish-backend` and `publish-frontend` in `.github/workflows/publish-ghcr-images.yml` MUST keep `needs: [preflight-checks, quality-gates]` with no `continue-on-error` and no gate-skipping inputs.
- Preserve the `spec 001` gateway auth contract: frontend web exports in CI and docs MUST NOT set or assert `EXPO_PUBLIC_CENTRAL_AUTH_URL`.
- Target architectures for published GHCR images MUST remain `linux/amd64,linux/arm64`.
- Backend runtime container MUST remain `debian:bookworm-slim` running as UID/GID `10001:10001`.
- Image builds MUST execute in GitHub Actions cloud sessions, NOT via local `docker buildx` in `scripts/push-ghcr.sh`.

## Review Focus

1. Building `backend/Dockerfile` for `linux/arm64` on an `amd64` host must use `--platform=$BUILDPLATFORM` and `GOOS=${TARGETOS} GOARCH=${TARGETARCH}` so `/app/api`, `/app/migrate`, and `/app/retranslate-senses` compile natively without invoking QEMU for `go build`.
2. `.github/workflows/publish-ghcr-images.yml` triggered by `push` to `main` (where `github.event.inputs.target` is empty) must run both `publish-backend` and `publish-frontend`.
3. `.github/workflows/publish-ghcr-images.yml` triggered by `workflow_dispatch` with `target: backend` must run `publish-backend` and skip `publish-frontend` (and vice versa for `target: frontend`), while still requiring `quality-gates` and `preflight-checks`.
4. None of `.github/workflows/publish-ghcr-images.yml`, `.cursor/skills/push-ghcr-images/SKILL.md`, `backend/docs/ghcr-deploy.md`, or `deploy/NETWORK_SETUP.md` may contain `EXPO_PUBLIC_CENTRAL_AUTH_URL`.
5. `scripts/push-ghcr.sh` must dispatch to GitHub Actions cloud sessions by default (`BUILD_MODE=cloud`), fail fast on invalid `TARGET` (e.g. `TARGET=invalid`), and reject `--local` / `BUILD_MODE=local` rather than running local `docker buildx`.

---

### Task 1: Switch `backend/Dockerfile` to Native `$BUILDPLATFORM` Cross-Compilation

**Files:**
- Modify: `backend/Dockerfile:1-10`

**Interfaces:**
- Consumes: BuildKit automatic platform args `BUILDPLATFORM`, `TARGETOS`, `TARGETARCH`
- Produces: Multi-arch `backend/Dockerfile` producing `/app/api`, `/app/migrate`, `/app/retranslate-senses` for `TARGETOS`/`TARGETARCH`

- [x] **Step 1: Verify `backend/Dockerfile` currently lacks `--platform=$BUILDPLATFORM` and `TARGETARCH`**

Run: `grep -n "BUILDPLATFORM\|TARGETARCH" backend/Dockerfile || echo "MISSING"`
Expected: `MISSING`

- [x] **Step 2: Update `backend/Dockerfile` builder stage to cross-compile natively on `$BUILDPLATFORM`**

Update lines 1-10 of `backend/Dockerfile` to:

```dockerfile
FROM --platform=$BUILDPLATFORM golang:1.26 AS builder
ARG TARGETOS=linux
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
    && GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate \
    && GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /out/retranslate-senses ./cmd/retranslate-senses
```

- [x] **Step 3: Verify `backend/Dockerfile` contains `--platform=$BUILDPLATFORM` and `GOOS=${TARGETOS} GOARCH=${TARGETARCH}`**

Run: `grep -n "BUILDPLATFORM\|TARGETARCH" backend/Dockerfile`
Expected: Matches `FROM --platform=$BUILDPLATFORM` and `GOOS=${TARGETOS} GOARCH=${TARGETARCH}`.

---

### Task 2: Consolidate & Optimize Cloud Image Publishing in `.github/workflows/publish-ghcr-images.yml`

**Files:**
- Modify: `.github/workflows/publish-ghcr-images.yml`
- Delete: `.github/workflows/publish-backend.yml`
- Modify: `specs/002-strict-local-verification/quickstart.md:55`

**Interfaces:**
- Consumes: `.github/workflows/quality-gates.yml`, `backend/Dockerfile`, `frontend/Dockerfile.web`
- Produces: `.github/workflows/publish-ghcr-images.yml` with `workflow_dispatch.inputs.target` (`all` | `backend` | `frontend`), ForwardAuth-aligned frontend build (`EXPO_PUBLIC_API_BASE_URL=`), scoped GHA BuildKit caching (`type=gha`), and OCI index annotations

- [x] **Step 1: Verify existing drift in `.github/workflows/publish-ghcr-images.yml` and presence of `.github/workflows/publish-backend.yml`**

Run: `grep -n "EXPO_PUBLIC_CENTRAL_AUTH_URL" .github/workflows/publish-ghcr-images.yml && test -f .github/workflows/publish-backend.yml && echo "DRIFT_PRESENT"`
Expected: Matches line 60 in `.github/workflows/publish-ghcr-images.yml` and outputs `DRIFT_PRESENT`.

- [x] **Step 2: Update `.github/workflows/publish-ghcr-images.yml`, delete `.github/workflows/publish-backend.yml`, and update `specs/002-strict-local-verification/quickstart.md`**

1. In `.github/workflows/publish-ghcr-images.yml`:
   - Under `on.workflow_dispatch:`, add `inputs.target` (`all`, `backend`, `frontend`; default `all`).
   - In `preflight-checks` (`Build and validate frontend web bundle`), remove `EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud` so it runs `EXPO_PUBLIC_API_BASE_URL= npm run web:export`.
   - In `publish-backend` and `publish-frontend`:
     - Keep `needs: [preflight-checks, quality-gates]`
     - Guard with `github.event.inputs.target` (`all` / empty / matching target)
     - Add `annotations: index:org.opencontainers.image.source=https://github.com/${{ github.repository }}`
     - Add `cache-from: type=gha,scope=<target>` and `cache-to: type=gha,mode=max,scope=<target>`.
2. Delete `.github/workflows/publish-backend.yml`.
3. In `specs/002-strict-local-verification/quickstart.md` line 55, replace `in publish-ghcr-images.yml and publish-backend.yml.` with `in publish-ghcr-images.yml.`.

- [x] **Step 3: Validate workflow invariants and absence of `EXPO_PUBLIC_CENTRAL_AUTH_URL` or `publish-backend.yml`**

Run: `! test -f .github/workflows/publish-backend.yml && ! grep -n "EXPO_PUBLIC_CENTRAL_AUTH_URL" .github/workflows/publish-ghcr-images.yml && grep -n "needs: \[preflight-checks, quality-gates\]" .github/workflows/publish-ghcr-images.yml && grep -n "cache-from: type=gha" .github/workflows/publish-ghcr-images.yml`
Expected: Exit code `0`, showing 2 `needs: [preflight-checks, quality-gates]` lines and 2 `cache-from: type=gha` lines.

---

### Task 3: Migrate `scripts/push-ghcr.sh` to a Pure GitHub Actions Cloud Session Dispatcher

**Files:**
- Modify: `scripts/push-ghcr.sh`

**Interfaces:**
- Consumes: `.github/workflows/publish-ghcr-images.yml` (`workflow_dispatch` input `target`)
- Produces: `scripts/push-ghcr.sh [--cloud] [--ref <git-ref>] [--watch]` defaulting to `BUILD_MODE=cloud` and `TARGET=all`, rejecting `--local` / `BUILD_MODE=local`

- [x] **Step 1: Update `scripts/push-ghcr.sh` to dispatch GitHub Actions cloud builds exclusively**

Update `scripts/push-ghcr.sh` so that:
1. Command-line flags `--cloud`, `--local`, `--watch`, `--ref <branch>`, and `-h`/`--help` are parsed (`BUILD_MODE="${BUILD_MODE:-cloud}"`).
2. `TARGET` (`backend` | `frontend` | `all`, default `all`) is validated first.
3. If `BUILD_MODE != "cloud"` (or `--local` is passed), fail fast with an error explaining that local Docker builds are retired and builds run in GitHub Actions cloud sessions.
4. Verify `command -v gh >/dev/null 2>&1 || die "missing required command: gh (GitHub CLI)"` and `command -v git >/dev/null 2>&1 || die "missing required command: git"`.
5. Resolve `GIT_REF="${GIT_REF:-$(git rev-parse --abbrev-ref HEAD)}"`.
6. Dispatch `gh workflow run publish-ghcr-images.yml --ref "$GIT_REF" -f target="$TARGET"`.
7. If `--watch` (or `WATCH=1`) is set, sleep 2 seconds, resolve the latest run ID with `gh run list --workflow=publish-ghcr-images.yml --branch "$GIT_REF" --limit 1 --json databaseId --jq '.[0].databaseId'`, and stream `gh run watch "$run_id" --exit-status`.

- [x] **Step 2: Test `scripts/push-ghcr.sh` argument validation, help output, and local-mode rejection**

Run: `bash -n scripts/push-ghcr.sh && scripts/push-ghcr.sh --help | grep -q "publish-ghcr-images.yml" && (TARGET=invalid scripts/push-ghcr.sh 2>&1 | grep -q "TARGET must be backend, frontend, or all") && (scripts/push-ghcr.sh --local 2>&1 | grep -q "local builds are retired")`
Expected: Exit code `0`.

---

### Task 4: Update Runbooks, `AGENTS.md`, and Skills for Cloud-Only Image Builds

**Files:**
- Modify: `AGENTS.md`
- Modify: `backend/docs/ghcr-deploy.md`
- Modify: `backend/docs/oracle-deploy-runbook.md`
- Modify: `backend/docs/go-backend-setup.md`
- Modify: `deploy/README.md`
- Modify: `deploy/NETWORK_SETUP.md`
- Modify: `deploy/deploy-exception-runbook.md`
- Modify: `.cursor/skills/deploy-oracle-k8s/SKILL.md`
- Modify: `.cursor/skills/push-ghcr-images/SKILL.md`

**Interfaces:**
- Consumes: `.github/workflows/publish-ghcr-images.yml` and `scripts/push-ghcr.sh` from Tasks 2 and 3
- Produces: Aligned documentation and agent skills reflecting GitHub Actions Cloud Session builds only and ForwardAuth frontend config

- [x] **Step 1: Update `AGENTS.md`, `backend/docs/*.md`, `deploy/*.md`, and `.cursor/skills/*/SKILL.md`**

1. In `AGENTS.md`:
   - Update production image documentation to state that images are built and published in GitHub Actions cloud sessions (`.github/workflows/publish-ghcr-images.yml`) automatically on push to `main` or triggered on demand via `scripts/push-ghcr.sh` (`TARGET=all scripts/push-ghcr.sh --watch` or `gh workflow run publish-ghcr-images.yml -f target=all`), not built locally.
2. In `backend/docs/ghcr-deploy.md`, `backend/docs/oracle-deploy-runbook.md`, `backend/docs/go-backend-setup.md`, `deploy/README.md`, `deploy/NETWORK_SETUP.md`, and `deploy/deploy-exception-runbook.md`:
   - Document GitHub Actions cloud session builds (`publish-ghcr-images.yml` on push to `main`, or `TARGET=all scripts/push-ghcr.sh --watch` / `gh workflow run publish-ghcr-images.yml -f target=all`).
   - Remove instructions that run local `docker buildx` or require a local `GHCR_TOKEN` PAT.
   - Remove stale `EXPO_PUBLIC_CENTRAL_AUTH_URL` references from `backend/docs/ghcr-deploy.md` and `deploy/NETWORK_SETUP.md`.
3. In `.cursor/skills/deploy-oracle-k8s/SKILL.md` and `.cursor/skills/push-ghcr-images/SKILL.md`:
   - Update instructions to trigger/watch the GitHub Actions cloud session (`scripts/push-ghcr.sh --watch` or `gh workflow run publish-ghcr-images.yml`) rather than starting a local Docker daemon or using a local `GHCR_TOKEN`.
   - Remove all references to `EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud`.

- [x] **Step 2: Verify no stale `EXPO_PUBLIC_CENTRAL_AUTH_URL` remains in build docs or skills**

Run: `! grep -n "EXPO_PUBLIC_CENTRAL_AUTH_URL" backend/docs/ghcr-deploy.md backend/docs/oracle-deploy-runbook.md deploy/NETWORK_SETUP.md .cursor/skills/push-ghcr-images/SKILL.md .cursor/skills/deploy-oracle-k8s/SKILL.md`
Expected: Exit code `0`.
