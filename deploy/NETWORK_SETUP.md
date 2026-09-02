# Project PN Network Setup (Oracle Cloud)

Production traffic for Project PN and central auth on `*.nacfson.cloud`.

## Production path

```text
Client → Oracle host nginx (TLS :443)
      → ingress-nginx (NodePort, e.g. 30489)
      → k3s Ingress $APP_PUBLIC_URL
      → project-pn-frontend / project-pn-backend (namespace project-pn)
```

Central auth: `auth.nacfson.cloud` → `auth-service` (central-auth) in namespace `nacfson-auth`.

## Public endpoints

| Service | URL |
|---------|-----|
| Project PN web + API | ${APP_PUBLIC_URL} |
| Central auth | `https://auth.nacfson.cloud` |
| Health | `${APP_PUBLIC_URL}/healthz`, `/readyz` |

## TLS

TLS terminates on the **Oracle host nginx** (Let's Encrypt via acme.sh or equivalent), proxying to ingress-nginx. Certificate material may also exist as k3s TLS secrets (e.g. `project-pn/pn-tls`).

Do not run a second nginx binding host `:80`/`:443` via Docker Compose on the same host.

## Client build URLs

Native and web production builds should use a **single** API origin:

```env
EXPO_PUBLIC_API_BASE_URL=${APP_PUBLIC_URL}
EXPO_PUBLIC_CENTRAL_AUTH_URL=https://auth.nacfson.cloud
```

Frontend GHCR image / Expo export must bake these in (see `scripts/push-ghcr.sh`).

## CORS

Backend `ALLOWED_ORIGINS` must include ${APP_PUBLIC_URL} and dev origins (`http://localhost:8081`, Tauri WebView origins). Configure via Cursor secrets / k3s Deployment env — not a Compose `.env` on the host.

## Intranet / split DNS (optional)

If you need the same hostname on home Wi‑Fi without hairpin NAT, use split DNS so $APP_PUBLIC_URL resolves to the Oracle public IP (or a VPN endpoint). Do not add secondary LAN API URLs to production mobile builds.

## Deploy

See [`backend/docs/oracle-deploy-runbook.md`](../backend/docs/oracle-deploy-runbook.md).

Secrets: [`backend/docs/cursor-secrets.md`](../backend/docs/cursor-secrets.md) (includes `scripts/sync-auth-google-secrets.sh` for Google OAuth).

## Removed legacy

Documentation for wlUbuntu (`192.168.219.120`), Compose `:53412`, router port-forwards to a home LAN host, and `~/project-pn/deploy/.env` was removed. Production is Oracle k3s only.
