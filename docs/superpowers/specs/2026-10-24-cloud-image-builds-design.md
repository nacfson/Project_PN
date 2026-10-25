# Cloud-Only Container Image Builds (GitHub Actions Cloud Session + Native Cross-Compilation)

## 1. Intent & Why

Project PN deploys multi-arch (`linux/amd64,linux/arm64`) container images (`ghcr.io/nacfson/project-pn-backend` and `ghcr.io/nacfson/project-pn-frontend`) to GitHub Container Registry (GHCR) for Oracle Cloud Ampere (`arm64`) and `nacfson_pipeline` (`proj-pn` namespace).

Previously, operator docs, agent skills, and `scripts/push-ghcr.sh` executed local builds (`docker buildx` + local `npm run web:export` on a developer or agent machine) as the image publishing mechanism, even though `.github/workflows/publish-ghcr-images.yml` existed in the repository. Even in the initial draft of this design, `scripts/push-ghcr.sh` still defaulted to `BUILD_MODE=local`, leaving local builds active by default. That caused four concrete problems:

1. **Local builds still ran by default in `scripts/push-ghcr.sh`:** Invoking `scripts/push-ghcr.sh` without flags ran `npm install`, `npm run web:export`, and multi-arch `docker buildx` locally instead of dispatching a GitHub Actions cloud session.
2. **Configuration drift between cloud and local docs/workflows:** `.github/workflows/publish-ghcr-images.yml`, `.cursor/skills/push-ghcr-images/SKILL.md`, and `deploy/NETWORK_SETUP.md` still referenced legacy `EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud`, whereas Project PN has migrated to platform Traefik ForwardAuth (`001-gateway-jwt-auth`) with only same-origin `EXPO_PUBLIC_API_BASE_URL=`.
3. **Slow QEMU `arm64` compilation in `backend/Dockerfile`:** `FROM golang:1.26 AS builder` omitted `--platform=$BUILDPLATFORM`, forcing `docker buildx` on `amd64` GitHub Actions runners to run the Go compiler inside QEMU `arm64` CPU emulation for all three binaries (`api`, `migrate`, `retranslate-senses`) instead of using Go's native cross-compiler (`GOOS=$TARGETOS GOARCH=$TARGETARCH`).
4. **Local credential & CPU burden + duplicate workflows:** Running local multi-arch builds required a local Docker daemon, local `GHCR_TOKEN` PAT (`write:packages`), lacked shared BuildKit layer caching, and coexisted with a redundant workflow (`.github/workflows/publish-backend.yml`).

Moving to a **GitHub Cloud Session Only Build Pattern** makes `.github/workflows/publish-ghcr-images.yml` the single image builder and publisher (automatically on push to `main` or on demand via `workflow_dispatch` / `scripts/push-ghcr.sh`), and converts `scripts/push-ghcr.sh` into a pure GitHub CLI (`gh workflow run`) cloud-session dispatcher with no local `docker buildx` execution.

## 2. Goals, Non-Goals, and Anti-Goals

- **Goals**:
  - **Cross-Compiled Multi-Arch Backend Dockerfile (`backend/Dockerfile`)**:
    - Use `FROM --platform=$BUILDPLATFORM golang:1.26 AS builder` with `ARG TARGETOS=linux` and `ARG TARGETARCH`.
    - Cross-compile `/out/api`, `/out/migrate`, and `/out/retranslate-senses` natively on the runner host architecture (`GOOS=${TARGETOS} GOARCH=${TARGETARCH}`).
  - **Canonical Cloud Publish Workflow (`.github/workflows/publish-ghcr-images.yml`)**:
    - Remove legacy `EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud` from `preflight-checks` so the Expo web export uses `EXPO_PUBLIC_API_BASE_URL=` only (`001-gateway-jwt-auth`).
    - Add a `workflow_dispatch` input `target` (`all`, `backend`, `frontend`; default `all`) so operators can trigger targeted cloud builds on demand while `push` to `main` always publishes both images.
    - Keep mandatory `quality-gates` (`needs: [preflight-checks, quality-gates]`) non-skippable per `spec 002`.
    - Add scoped GitHub Actions BuildKit caching (`cache-from: type=gha,scope=backend` / `cache-to: type=gha,mode=max,scope=backend` and `scope=frontend`) and OCI index annotations (`index:org.opencontainers.image.source=https://github.com/${{ github.repository }}`) on both publish jobs.
    - Delete redundant `.github/workflows/publish-backend.yml` and update references in `specs/002-strict-local-verification/quickstart.md`.
  - **Pure Cloud-Session Dispatcher in `scripts/push-ghcr.sh`**:
    - Replace local `docker buildx` and local `npm run web:export` in `scripts/push-ghcr.sh` with a GitHub Actions cloud-session trigger (`gh workflow run publish-ghcr-images.yml --ref "$GIT_REF" -f target="$TARGET"`).
    - Default to cloud execution (`TARGET="${TARGET:-all}"`), accept `--cloud` (default/compatibility flag), `--ref <git-ref>`, and `--watch` (`WATCH=1`) to stream the remote GitHub Actions run (`gh run watch --exit-status`).
    - Reject `--local` or `BUILD_MODE=local` with a clear error message stating that local image builds are retired in favor of GitHub Actions cloud sessions.
  - **Documentation & Skill Alignment**:
    - Update `AGENTS.md`, `backend/docs/oracle-deploy-runbook.md`, `backend/docs/ghcr-deploy.md`, `backend/docs/go-backend-setup.md`, `deploy/README.md`, `deploy/NETWORK_SETUP.md`, `deploy/deploy-exception-runbook.md`, `.cursor/skills/deploy-oracle-k8s/SKILL.md`, and `.cursor/skills/push-ghcr-images/SKILL.md` so all image builds use the GitHub Actions cloud session (`publish-ghcr-images.yml` / `scripts/push-ghcr.sh`) and stale `EXPO_PUBLIC_CENTRAL_AUTH_URL` or local `GHCR_TOKEN` build instructions are removed.
- **Non-Goals**:
  - Changing the Kubernetes cluster rollout mechanism (`kubectl set image` on Oracle Cloud k3s or FluxCD GitOps in `nacfson_pipeline`).
  - Adding paid third-party cloud build SaaS dependencies (e.g., Docker Build Cloud or Depot).
- **Anti-Goals**:
  - Running local `docker buildx` or requiring local `GHCR_TOKEN` to build/publish production images.
  - Bypassing or weakening `.github/workflows/quality-gates.yml` on any cloud image publish path (`spec 002`).
  - Reintroducing `EXPO_PUBLIC_CENTRAL_AUTH_URL` into the frontend web export (`spec 001`).

## 3. Constraints

- Must preserve `spec 002` CI quality gate contract: `publish-backend` and `publish-frontend` in `.github/workflows/publish-ghcr-images.yml` must depend on `quality-gates` and `preflight-checks` with no skip inputs or `continue-on-error`.
- Multi-arch target platforms must remain `linux/amd64,linux/arm64` (`arm64` required by Oracle Cloud Ampere).
- Backend runtime image must remain `debian:bookworm-slim` running as non-root UID/GID `10001:10001`.

## 4. Approaches Considered

### Approach A (Selected): GitHub Actions Cloud Session Only + `$BUILDPLATFORM` Native Go Cross-Compilation
- Uses `.github/workflows/publish-ghcr-images.yml` on GitHub-hosted runners as the exclusive builder, paired with `FROM --platform=$BUILDPLATFORM` in `backend/Dockerfile`, GHA BuildKit caching (`type=gha`), and `scripts/push-ghcr.sh` converted into a pure `gh workflow run` cloud-session dispatcher.
- **Pros:** Zero local CPU/Docker burden, no local `GHCR_TOKEN` required, enforces `quality-gates.yml` before any image is pushed, and eliminates slow QEMU Go compilation on `amd64` runners.

### Approach B (Rejected): Hybrid Local Default with Optional `--cloud` Flag
- Keeping `BUILD_MODE=local` as the default in `scripts/push-ghcr.sh` and requiring `--cloud` to opt into GitHub Actions.
- **Rejected:** Operators and agents invoking `scripts/push-ghcr.sh` still trigger slow local `docker buildx` builds by default, require local `GHCR_TOKEN` secrets, and can push images from unverified local working trees.

### Approach C (Rejected): Remote BuildKit Daemon on Oracle Ampere k3s Cluster
- Exposing or SSH-tunneling a `buildkitd` pod on the Oracle Cloud Ampere cluster and pointing local `docker buildx` at it.
- **Rejected:** Couples image building to production cluster availability, still relies on unverified local working trees, and requires SSH/kubeconfig access just to build an image.
