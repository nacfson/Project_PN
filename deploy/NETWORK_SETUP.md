# Project_PN Network Setup

Current deployment configuration for the Project PN web app and backend API on `wlUbuntu` (LAN `192.168.219.120`).

The frontend is a static Expo web bundle served by nginx. API routes are proxied to the Go backend.

## wlUbuntu cutover checklist

Use this when moving Project PN (Docker Compose) or verifying router/DNS after a host migration to `wlUbuntu`:

1. **Static lease:** Reserve DHCP / static IP `192.168.219.120` for `wlUbuntu` on the home router.
2. **SSH:** Confirm `ssh wlUbuntu` works from your Mac (`Host` alias in `~/.ssh/config`).
3. **Router port-forward (WAN → LAN):** Forward these TCP ports to `192.168.219.120`:
   - `80` → `80` (HTTPS redirect / cert challenges)
   - `443` → `443` (production `https://pn.nacfson.cloud`)
   - `53412` → `53412` (optional HTTP staging on custom port)
4. **LAN split DNS:** Run [`ProcessManager/deploy/landns`](../../ProcessManager/deploy/landns) (dnsmasq on wlUbuntu) and set LG U+ DHCP DNS to `192.168.219.120`, so `*.nacfson.cloud` → `192.168.219.120` on Wi‑Fi. Public Gabia DNS stays `124.59.225.59`.
5. **Deploy path:** `scripts/deploy-remote.sh` with `DEPLOY_HOST=wlUbuntu` in `deploy/.deploy.env`.
6. **Smoke tests:**
   ```bash
   curl -fsS http://192.168.219.120:53412/healthz
   curl -fsS https://pn.nacfson.cloud/readyz
   curl -fsS -o /dev/null -w '%{http_code}\n' https://auth.nacfson.cloud/login
   echo | openssl s_client -connect 192.168.219.120:443 -servername pn.nacfson.cloud 2>/dev/null \
     | openssl x509 -noout -issuer   # expect Let's Encrypt
   ```

## Server Addresses

| Type | Address | Interface |
|---|---|---|
| Public IP | `124.59.225.59` | WAN |
| Production HTTPS | `https://pn.nacfson.cloud` | ingress-nginx → Compose |
| Central auth | `https://auth.nacfson.cloud` | ingress-nginx → `auth-service` |
| Staging HTTP | `http://192.168.219.120:53412` | Compose nginx only |
| Intranet (wlUbuntu) | `192.168.219.120` | primary deploy host |

## TLS and traffic path (production)

Production HTTPS for `pn.nacfson.cloud` and `auth.nacfson.cloud` terminates on
**ingress-nginx** (hostNetwork on wlUbuntu ports `80`/`443`), not on Compose
port bindings.

| Host | Backend |
|---|---|
| `pn.nacfson.cloud` | Service `pn-compose` → host `192.168.219.120:53412` (Compose nginx) |
| `auth.nacfson.cloud` | Service `auth-service:8080` in namespace `nacfson-auth` |

Certificates are **Let's Encrypt** (issued with `acme.sh --alpn` on port 443
because WAN port 80 often hits the home router admin UI). Certs are installed to:

- K8s secrets `project-pn/pn-tls` and `nacfson-auth/auth-service-tls`
- Compose files `~/project-pn/deploy/certs/{fullchain,privkey}.pem`

Renewal: `acme.sh` cron + `/root/acme-reload-hook.sh` (copies into K8s secrets
and recreates Compose nginx / restarts ingress).

Do **not** re-enable cert-manager self-signed on the auth Ingress, or it will
overwrite the LE secret. Auth Ingress has no `cert-manager.io/*` annotation.

Manifest: `ProcessManager/k8s/project-pn/compose-ingress.yaml`.

## Backend Configuration

File: `~/project-pn/deploy/.env`

```bash
APP_PUBLIC_URL=https://pn.nacfson.cloud
AUTH_MODE=central
CENTRAL_AUTH_URL=https://auth.nacfson.cloud
# Compose cannot use in-cluster DNS; use auth-service NodePort HTTP for ValidateSession
CENTRAL_AUTH_INTERNAL_URL=http://192.168.219.120:<auth-nodeport>
ALLOWED_ORIGINS=https://pn.nacfson.cloud,http://192.168.219.120:53412,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

`deploy/compose.yaml` must pass `AUTH_MODE`, `CENTRAL_AUTH_URL`, and
`CENTRAL_AUTH_INTERNAL_URL`, and set `extra_hosts` to
`auth.nacfson.cloud:192.168.219.120`.

## Nginx Ports

Compose publishes staging HTTP only:

- `53412:80` → Compose nginx (static web + `/api` proxy)

Ingress owns production:

- Host `80` / `443` → ingress-nginx (TLS for `pn` + `auth`)

Required router port-forwarding:

```text
WAN 80   → 192.168.219.120:80
WAN 443  → 192.168.219.120:443
WAN 53412 → 192.168.219.120:53412   # optional staging
```

If WAN `80` shows the router page (`/etc/intro.asp`), port 80 is **not**
forwarded to wlUbuntu. Prefer HTTPS. TLS-ALPN issuance still needs WAN `443`
to wlUbuntu.

Do not set the internal/private port to `22-22`; that forwards public traffic
to SSH instead of Project PN.

## Frontend Base URLs

### Web (nginx-served)

Leave `EXPO_PUBLIC_API_BASE_URL` **unset** so the app resolves API calls from
`window.location.origin`. The same bundle works whether you open the site via
the public hostname or an intranet URL.

| Build Target | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|
| Local dev | `http://localhost:8080` |
| nginx-served staging/production | *(unset / empty)* |

The deploy script builds the bundle with:

```bash
cd frontend
EXPO_PUBLIC_API_BASE_URL= npm run web:export
```

### Native / phone (single URL)

Release builds bake **one** API host only:

```bash
EXPO_PUBLIC_API_BASE_URL=https://pn.nacfson.cloud
```

Do **not** set `EXPO_PUBLIC_API_FALLBACK_URLS` in production (EAS / `.env.production` /
`ios:prod:*` scripts). Client fallbacks are ignored outside `__DEV__` and cause
multi-second hangs on cellular when a private LAN IP is listed.

Never leave `EXPO_PUBLIC_API_BASE_URL=` empty in `.env.production.local` — an empty
assignment clears the production URL and iOS Release can fall back to
`http://localhost:8080` (unreachable on a physical device).

### Build iOS from Xcode (not npm)

Xcode’s “Bundle React Native code and images” script sources:

1. `frontend/ios/.xcode.env` (versioned defaults)
2. `frontend/ios/.xcode.env.local` (machine-local Node path / overrides)

Required for Release embeds:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` (if unset, Expo loads only `.env.local` + `.env` and can bake localhost) |
| `EXPO_PUBLIC_API_BASE_URL` | `https://pn.nacfson.cloud` |
| `EXPO_PUBLIC_CENTRAL_AUTH_URL` | `https://auth.nacfson.cloud` |

These defaults live in `frontend/ios/.xcode.env`. Confirm with:

```bash
# After a Release build — expect pn.nacfson.cloud, not localhost:8080
strings ~/Library/Developer/Xcode/DerivedData/ProjectPN-*/Build/Products/Release-iphoneos/ProjectPN.app/main.jsbundle \
  | grep -E 'pn\.nacfson\.cloud|localhost:8080' | sort -u
```

Steps:

1. Plug in the iPhone; unlock / trust.
2. Open `frontend/ios/ProjectPN.xcworkspace`.
3. Scheme **Release**, destination = physical device.
4. Product → Clean Build Folder, then Run.
5. Delete any older install first if you previously shipped a localhost bake.

**Debug** scheme skips embedding JS (`SKIP_BUNDLING=1`) and loads from Metro — then
`frontend/.env.local` must point at a reachable API (not `http://localhost:8080` on a
physical phone). Prefer Release for device testing against production.

Optional CLI rebuild (same env as Xcode):

```bash
cd frontend/ios
source .xcode.env && source .xcode.env.local
xcodebuild -workspace ProjectPN.xcworkspace -scheme ProjectPN \
  -configuration Release -destination 'generic/platform=iOS' build
```

### Intranet via split DNS (not a second client URL)

Home routers often lack NAT hairpin, so phones on Wi‑Fi cannot reach the WAN IP.
Support intranet without baking `192.168.219.x` into the app:

1. Give `wlUbuntu` a **static DHCP lease** at `192.168.219.120`.
2. On the LAN DNS (router local DNS, Pi-hole, AdGuard, etc.), add:

   ```text
   pn.nacfson.cloud    →  192.168.219.120
   auth.nacfson.cloud  →  192.168.219.120
   ```

3. Outside the LAN, public DNS must keep resolving those names to the
   public IP (HTTPS on port 443 → wlUbuntu ingress).
4. Confirm ingress presents Let's Encrypt for both hosts:

   ```bash
   echo | openssl s_client -connect 192.168.219.120:443 -servername pn.nacfson.cloud 2>/dev/null \
     | openssl x509 -noout -issuer -subject
   ```

| Network | `pn.nacfson.cloud` / `auth.nacfson.cloud` should resolve to |
|---|---|
| Cellular / internet | Public IP (443 → ingress on wlUbuntu) |
| Home Wi‑Fi | `192.168.219.120` (LAN DNS override) |

Verify from both networks:

```bash
curl -fsS https://pn.nacfson.cloud/readyz
curl -fsS https://pn.nacfson.cloud/healthz
curl -fsS -o /dev/null -w '%{http_code}\n' https://auth.nacfson.cloud/login
```

On Wi‑Fi, confirm the override:

```bash
# macOS example — expect 192.168.219.120 when on home LAN
dscacheutil -q host -a name pn.nacfson.cloud
dscacheutil -q host -a name auth.nacfson.cloud
```

## Web Bundle

nginx serves the static files from `~/project-pn/deploy/web/` (mounted at `/usr/share/nginx/web` in the container).

Files are uploaded by `scripts/deploy-remote.sh` after running `npm run web:export`.

nginx routes:

| Path | Destination |
|---|---|
| `/` | Static SPA (`index.html`) |
| `/api/*` | Go backend (`api:8080`) |
| `/healthz`, `/readyz` | Go backend (`api:8080`) |
| `/auth/callback` | Go backend (`api:8080`) |

## API Endpoints

| Action | Method | Path |
|---|---|---|
| Health check | GET | `/healthz` |
| Me | GET | `/api/auth/me` |
| Logout | POST | `/api/auth/logout` |
| Lookup word | POST | `/api/words/lookup` |
| Add learning item | POST | `/api/learning-items` |

Full example:

```bash
curl -X GET https://pn.nacfson.cloud/api/auth/me \
  -H "Authorization: Bearer <central-token>"
```

Central login is magic-link-only at `https://auth.nacfson.cloud/login?rd=...`
(not local password routes; `AUTH_MODE=central`).

## How to Update CORS Origins

1. Edit `~/project-pn/deploy/.env`.
2. Update `ALLOWED_ORIGINS` with the new origin.
3. Restart the API container:

```bash
cd ~/project-pn/deploy
docker compose up -d --no-deps api nginx
```

## Testing

From the server:

```bash
curl http://localhost:53412/healthz
curl -fsS --resolve pn.nacfson.cloud:443:127.0.0.1 https://pn.nacfson.cloud/readyz
```

From another device on the same LAN:

```bash
curl http://192.168.219.120:53412/healthz
curl -fsS --resolve pn.nacfson.cloud:443:192.168.219.120 https://pn.nacfson.cloud/readyz
curl -fsS -o /dev/null -w '%{http_code}\n' --resolve auth.nacfson.cloud:443:192.168.219.120 https://auth.nacfson.cloud/login
```

From public internet (needs WAN `443` → `.120`):

```bash
curl -fsS https://pn.nacfson.cloud/readyz
curl -fsS -o /dev/null -w '%{http_code}\n' https://auth.nacfson.cloud/login
```

If `http://124.59.225.59/` opens the router admin page (`intro.asp`), public
port `80` is not forwarded to `wlUbuntu`. Prefer HTTPS on `443`. Optional
staging: `http://124.59.225.59:53412/` when that port is forwarded.

## Notes

- Intranet IPs can change after router reboot. Set a **static DHCP lease** for
  `wlUbuntu` at `192.168.219.120` and keep LAN DNS overrides for
  `pn.nacfson.cloud` and `auth.nacfson.cloud` in sync.
- Native release clients use only `https://pn.nacfson.cloud` (no LAN fallback
  URLs). Intranet phones rely on split DNS, not a second baked API base.
- Production TLS is Let's Encrypt on ingress; see the TLS section above.
- Current deploy may still use `EMAIL_PROVIDER=log` where that staging/dev
  configuration is enabled.
