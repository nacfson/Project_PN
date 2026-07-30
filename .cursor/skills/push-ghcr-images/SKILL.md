---
name: push-ghcr-images
description: >-
  Build and push both Project PN Docker images (backend + frontend) to GHCR as
  multi-arch (linux/amd64, linux/arm64). Use when the user asks to push GHCR
  images, publish both images, upload frontend and backend to ghcr.io, refresh
  ProcessManager images, or run TARGET=all for scripts/push-ghcr.sh.
---

# Push Project PN Images to GHCR

Publishes **both** multi-arch images used by ProcessManager / public k8s:

| Image | Registry |
|-------|----------|
| Backend API | `ghcr.io/nacfson/project-pn-backend` |
| Frontend SPA (nginx) | `ghcr.io/nacfson/project-pn-frontend` |

Platforms: `linux/amd64` + `linux/arm64`.

## Prerequisites

- [ ] Docker daemon is running (`sudo /etc/init.d/docker start` if needed).
- [ ] `GHCR_TOKEN` is set (PAT with `write:packages`). Never print the token value.
- [ ] `npm` is available (frontend web export).
- [ ] Network can reach `ghcr.io` and container registries for base images.

Check token presence only:

```sh
[ -n "${GHCR_TOKEN:-}" ] && echo "GHCR_TOKEN=SET len=${#GHCR_TOKEN}" || echo "GHCR_TOKEN=UNSET"
```

## One-shot: push both images

From the repo root:

```sh
GHCR_TOKEN=... TARGET=all scripts/push-ghcr.sh
```

This will:

1. `npm install` + `web:export` for the frontend with:
   - `EXPO_PUBLIC_API_BASE_URL=` (empty → same-origin API via Ingress)
   - `EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud` (baked into the SPA)
2. Guard that `frontend/dist` contains `auth.nacfson.cloud`
3. `docker buildx` push `project-pn-frontend:<sha>` and `:latest`
4. `docker buildx` push `project-pn-backend:<sha>` and `:latest`

### Frontend-only or backend-only

```sh
GHCR_TOKEN=... TARGET=frontend scripts/push-ghcr.sh
GHCR_TOKEN=... TARGET=backend scripts/push-ghcr.sh
```

### Override auth bake URL (rare)

```sh
EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud \
  GHCR_TOKEN=... TARGET=all scripts/push-ghcr.sh
```

## Verify

```sh
docker buildx imagetools inspect ghcr.io/nacfson/project-pn-frontend:latest
docker buildx imagetools inspect ghcr.io/nacfson/project-pn-backend:latest
```

Each index should list **linux/amd64** and **linux/arm64**.

## ProcessManager / public site

After push, roll the Deployments to the new digests (or `:latest` if that tag is used):

```text
ghcr.io/nacfson/project-pn-frontend:latest
ghcr.io/nacfson/project-pn-backend:latest
```

Private packages need a cluster `imagePullSecret` (PAT with `read:packages`).

Sign In must open `https://auth.nacfson.cloud/login?rd=...`, not `https://pn.nacfson.cloud/login`. If Sign In is wrong, the frontend image was built without `EXPO_PUBLIC_CENTRAL_AUTH_URL` — re-run `TARGET=frontend` or `TARGET=all`.

## Do not

- Do not print `GHCR_TOKEN` or paste it into logs/PRs.
- Do not set `EXPO_PUBLIC_CENTRAL_AUTH_URL=` empty for GHCR frontend builds.
- Do not push only the backend when the user asked to refresh the public site images — use `TARGET=all`.
