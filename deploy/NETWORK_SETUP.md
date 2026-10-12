# Project PN Network Setup (Oracle Cloud)

Production traffic for Project PN and central auth on `*.nacfson.cloud`.

## Production path

### Platform path (nacfson_pipeline, target)

```text
Client → Cloudflare DNS / proxy (optional orange-cloud)
      → Traefik (namespace platform) — TLS terminated here (platform cert, spec 008)
      → plain HTTP inside the cluster
      → pn-frontend:80 (SPA)  |  pn-backend:8080 (PathPrefix /api)   (namespace proj-pn)
```

See [TLS (platform-owned, spec 008)](#tls-platform-owned-spec-008).

### Legacy path (Oracle host nginx, rollback only)

```text
Client → Cloudflare DNS / proxy (optional orange-cloud)
      → Oracle host nginx (TLS :443)
      → ingress-nginx (NodePort, e.g. 30489)
      → k3s Ingress $APP_PUBLIC_URL
      → project-pn-frontend / project-pn-backend (namespace project-pn)
```

Central auth: `auth.nacfson.cloud` → `auth-service` (central-auth) in namespace `nacfson-auth`.

## Proxy timeouts (word lookup / add)

Cold cache lookups can take ~22s when WiktApi times out and Gemini fallback still succeeds. The shared API client waits up to **60s** so the UI does not abort as ADD-101 while the server is still working.

Pin **≥ 60s** on every hop that proxies `/api`:

| Hop | Setting | Value |
|-----|---------|-------|
| Host nginx (`/etc/nginx/conf.d/pn.nacfson.cloud.conf`) | `proxy_read_timeout` / `proxy_send_timeout` | `60s` |
| ingress-nginx (`project-pn` Ingress) | `nginx.ingress.kubernetes.io/proxy-read-timeout` / `proxy-send-timeout` | `"60"` |
| Frontend nginx ConfigMap (`project-pn-nginx`, `location /api/`) | `proxy_read_timeout` / `proxy_send_timeout` | `60s` |

Manifests live in ProcessManager `k8s/project-pn/`. After changing the ConfigMap, restart `project-pn-frontend` so pods remount nginx.conf.

## Public endpoints

| Service | URL |
|---------|-----|
| Project PN web + API | ${APP_PUBLIC_URL} |
| Central auth | `https://auth.nacfson.cloud` |
| Health | `${APP_PUBLIC_URL}/healthz`, `/readyz` |

## Cloudflare DNS records

Nameservers for `nacfson.cloud` are Cloudflare. After any registrar NS cutover, recreate these zone records or hostnames will NXDOMAIN even when the Oracle origin is healthy.

| Name | Type | Target | Proxy |
|------|------|--------|-------|
| `pn` | `A` | Oracle public IPv4 (same as origin behind `auth`) | Proxied (orange cloud), matching `auth` |
| `auth` | `A` | Oracle public IPv4 | Proxied |
| `@` (apex) | `A` | Oracle public IPv4 | Proxied if you serve a site on the apex |
| `www` | `A` or `CNAME` | same origin, or `@` | Proxied if used |

**SSL/TLS mode:** Full (strict). The origin serves a publicly trusted Let’s Encrypt certificate for the Project PN and auth hostnames (platform Traefik on the platform path; host nginx on the legacy Oracle path). Flexible mode causes broken or mis-encrypted origin connections (often Cloudflare 525/526).

**Cutover checklist:**

1. Copy the IPv4 from the working `auth` record (or Cursor secret `DEPLOY_SSH_HOST`).
2. Ensure the `pn` A record exists before switching nameservers (or immediately after).
3. Confirm `curl -fsS ${APP_PUBLIC_URL}/healthz` and `/readyz` return success and responses include `CF-RAY` when proxied.
4. Optional Cursor secrets for agent-managed DNS: `CLOUDFLARE_API_TOKEN` (Zone → DNS → Edit) and `CLOUDFLARE_ZONE_ID`.

## TLS (platform-owned, spec 008)

On the nacfson_pipeline platform, Traefik (namespace `platform`) terminates TLS for `pn.nacfson.cloud`. The platform owns the Let's Encrypt certificate, the private key and renewal (renewed with at least 30 days of validity left). `http://` requests get a permanent (301/308) redirect to HTTPS at Traefik. The `proj-pn` namespace holds no certificate, key, validation pod or TLS firewall exception.

PN pods receive **plain HTTP**: Traefik → `pn-frontend:80` (SPA) and `pn-backend:8080` (`/api`). Traefik sets `X-Forwarded-Proto: https` and `X-Forwarded-Host`. The `strip-forged-headers` middleware does not remove them.

App rules:

- Never add certificate/key files, a TLS listener (`:443`, `ListenAndServeTLS`), or an in-app HTTP→HTTPS redirect. The app sees `http` on the wire, so an app-side redirect loops.
- Build public URLs from configuration (`https://pn.nacfson.cloud`) or `window.location.origin`. Never use the raw request scheme.
- Cookies keep `Secure` / `HttpOnly` / `SameSite`. The backend derives the CSRF cookie's `Secure` flag from `X-Forwarded-Proto` (`requestIsSecure` in `backend/internal/http/csrf.go`). That header is trusted because the `proj-pn` NetworkPolicy admits only the `platform` namespace and `pn-frontend`.
- Outgoing calls to external services (WiktApi, Gemini, Google) use HTTPS with normal certificate verification. Never disable verification.
- In-cluster calls (Keycloak JWKS, identity gateway) stay plain HTTP. **Cluster traffic is not encrypted** (no mTLS / service mesh). Do not rely on it for end-to-end confidentiality.

Publishing a new hostname: ask the platform to add it to the platform certificate list, then add the route with `tls: {}` in the project IngressRoute. Pre-deploy validation rejects a route whose hostname is not covered (FR-010).

Verify after a rollout:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://pn.nacfson.cloud/
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://pn.nacfson.cloud/
# Issuer must be Let's Encrypt, not "TRAEFIK DEFAULT CERT"
echo | openssl s_client -connect pn.nacfson.cloud:443 -servername pn.nacfson.cloud 2>/dev/null \
  | openssl x509 -noout -issuer -subject -enddate
```

### Legacy (Oracle host nginx)

TLS terminates on the **Oracle host nginx** (Let's Encrypt via acme.sh or equivalent), proxying to ingress-nginx. Certificate material may also exist as k3s TLS secrets (e.g. `project-pn/pn-tls`). When Cloudflare proxy is enabled, Cloudflare presents its edge cert to clients and connects to origin with Full (strict).

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
