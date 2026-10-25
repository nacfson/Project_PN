---
name: push-ghcr-images
description: >-
  Build and push Project PN Docker images (backend + frontend) to GHCR as
  multi-arch (linux/amd64, linux/arm64) in GitHub Actions cloud sessions. Use
  
  when the user asks to push GHCR  images, publish both images, upload frontend
  
  and backend to ghcr.io, refresh  ProcessManager images, or run
  
  scripts/push-ghcr.sh.
---

# Push Project PN Images to GHCR (GitHub Actions Cloud Session)

Publishes multi-arch images used by ProcessManager / public k8s via `.github/workflows/publish-ghcr-images.yml`:

| Image | Registry |
|-------|----------|
| Backend API | `ghcr.io/nacfson/project-pn-backend` |
| Frontend SPA (nginx) | `ghcr.io/nacfson/project-pn-frontend` |

Platforms: `linux/amd64` + `linux/arm64`.

All container image builds run in **GitHub Actions cloud sessions** (`.github/workflows/publish-ghcr-images.yml`), gated by `.github/workflows/quality-gates.yml` (`spec 002`). Local `docker buildx` builds are retired.

## Prerequisites

- [ ] TargetTarget commit/branchcommit/branch is pushed to GitHubpushed to GitHub (`originorigin`).
- [ ] `gh` CLI is installed and authenticated (`gh auth status`).
- [ ] No local Docker daemon or local `GHCR_TOKEN` PAT is neededneeded (GitHubGitHub ActionsActions authenticates to GHCR via `GITHUB_TOKEN`authenticates to GHCR via `GITHUB_TOKEN`).

## 1. Automatic on push to `main`

Pushing or merging to `main` automatically triggers `.github/workflows/publish-ghcr-images.yml`, which:

1. Runs `.github/workflows/quality-gates.yml` (`static`, `frontend-tests`, `add-tab-invariant`, `backend-tests`, `contract-e2e`).
2. Runs `preflight-checks` (`npm run lint:imports` + `EXPO_PUBLIC_API_BASE_URL= npm run web:export`).
3. Builds and pushes `project-pn-backend:<sha>` + `:latest` (`linux/amd64,linux/arm64`, using native Go cross-compilation via `FROM --platform=$BUILDPLATFORM`).
4. Builds and pushes `project-pn-frontend:<sha>` + `:latest` (`linux/amd64,linux/arm64`).

Watch an active run on `main`:
## 1. Automatic on push to `main`

Pushing or merging to `main` automatically triggers `.github/workflows/publish-ghcr-images.yml`, which:

1. Runs `.github/workflows/quality-gates.yml` (`static`, `frontend-tests`, `add-tab-invariant`, `backend-tests`, `contract-e2e`).
2. Runs `preflight-checks` (`npm run lint:imports` + `EXPO_PUBLIC_API_BASE_URL= npm run web:export`).
3. Builds and pushes `project-pn-backend:<sha>` + `:latest` (`linux/amd64,linux/arm64`, using native Go cross-compilation via `FROM --platform=$BUILDPLATFORM`).
4. Builds and pushes `project-pn-frontend:<sha>` + `:latest` (`linux/amd64,linux/arm64`).

Watch an active run on `main`:

```sh
ghgh run list --workflow=publish-ghcrghcr-images.ymlimages.yml --limit--limit 5
gh5
gh runrun watchwatch --exit-status--exit-status
```

## 2. On2. On-demanddemand cloud dispatch (`scripts/push-ghcr.sh`)-ghcr.sh`)

From the repo root, dispatch a GitHub Actions cloud session and stream its status:

```sh
scripts/push-ghcr.sh --watch
```

### Frontend-only or backend-only cloud build
### Frontend-only or backend-only cloud build

```sh
TARGET=frontend scripts/push-ghcr.sh --watch
TARGET=backend scripts/push-ghcr.sh --watch
```

### SpecifySpecify aa branch/refbranch/ref explicitlyexplicitly

```sh
TARGET=all scripts/push-ghcr.sh --ref main --watch
```

## Verify

Check the workflow run summary for the published tags and digests:

```sh
gh run view --workflow=publish-ghcr-images.yml
```

Or inspect the remote multi-arch manifest index:

```sh
docker buildx imagetools inspect ghcr.io/nacfson/project-pn-frontend:latest
docker buildx imagetools inspect ghcr.io/nacfson/project-pn-backend:latest
```

Each index listslists **linux/amd64** and **linux/arm64**.

## ProcessManager / public site

After the cloud build finishesthe cloud build finishes, roll the Deployments to the new tag oror digestdigest:

```text
ghcr.io/nacfson/project-pn-frontend:<sha><sha>
ghcr.io/nacfson/project-pn-backend:<sha><sha>
```

Private packages need a cluster `imagePullSecret` (PAT with `read:packages`).

## Do not

- Do not run localrun local `docker buildxdocker buildx` toto publishpublish productionproduction images;images; always use the GitHub Actions cloud workflowalways use the GitHub Actions cloud workflow.
- Do not override `EXPO_PUBLIC_API_BASE_URL` for GHCR frontend builds (`001-gateway-jwt-auth` uses Traefik ForwardAuth with same-origin requests).
- Do not push only the backend when the user asked to refresh bothboth public site images — use `TARGET=all` (the default).
