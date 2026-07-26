# Project_PN Network Setup

Current deployment configuration for the Project PN web app and backend API on `zlUbuntu`.

The frontend is a static Expo web bundle served by nginx. API routes are proxied to the Go backend.

## Server Addresses

| Type | Address | Interface |
|---|---|---|
| Public IP | `124.59.225.59` | WAN |
| Public API URL | `http://124.59.225.59:53412` | nginx → backend |
| Intranet (Ethernet) | `192.168.219.100` | `enp0s31f6` |
| Intranet (Wi-Fi) | `192.168.219.109` | `wlp2s0` |

## Backend Configuration

File: `~/project-pn/deploy/.env`

```bash
APP_PUBLIC_URL=http://124.59.225.59:53412
ALLOWED_ORIGINS=http://124.59.225.59:53412,http://192.168.219.100:53412,http://192.168.219.109:53412,http://localhost:8081
```

## Nginx Ports

From `compose.yaml`:

- `80:80`   → HTTP
- `443:443` → HTTPS (requires certs)
- `53412:80` → Public staging access on non-standard port

Required router port-forwarding rule for public staging:

```text
Protocol:              TCP
External/WAN port:     53412-53412
Internal/LAN IP:       192.168.219.100
Internal/private port: 53412-53412
Status:                ON / enabled
```

Do not set the internal/private port to `22-22`; that forwards public staging
traffic to SSH instead of nginx/Project PN.

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

1. Give `zlUbuntu` a **static DHCP lease** (e.g. `192.168.219.100`).
2. On the LAN DNS (router local DNS, Pi-hole, AdGuard, etc.), add:

   ```text
   pn.nacfson.cloud  →  192.168.219.100
   ```

3. Outside the LAN, public DNS must keep resolving `pn.nacfson.cloud` to the
   public IP / ingress (HTTPS on port 443).
4. Confirm nginx serves TLS for `server_name pn.nacfson.cloud` on the LAN host
   (same cert used publicly).

| Network | `pn.nacfson.cloud` should resolve to |
|---|---|
| Cellular / internet | Public IP (443 → nginx/ingress) |
| Home Wi‑Fi | `192.168.219.100` (LAN DNS override) |

Verify from both networks:

```bash
# Should succeed on cellular and on Wi‑Fi after split DNS
curl -fsS https://pn.nacfson.cloud/readyz
curl -fsS https://pn.nacfson.cloud/healthz
```

On Wi‑Fi, confirm the override:

```bash
# macOS example — expect 192.168.219.100 when on home LAN
dscacheutil -q host -a name pn.nacfson.cloud
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
| Login | POST | `/api/auth/login` |
| Register | POST | `/api/auth/register` |
| Google OAuth | POST | `/api/auth/oauth/google` |
| Magic link | POST | `/api/auth/magic-link` |
| Me | GET | `/api/auth/me` |
| Lookup word | POST | `/api/words/lookup` |
| Add learning item | POST | `/api/learning-items` |

Full example:

```bash
curl -X POST http://124.59.225.59:53412/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

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
curl http://localhost:53412/ | head
```

From another device on the same LAN:

```bash
curl http://192.168.219.100:53412/healthz
curl http://192.168.219.100:53412/ | head
# or
curl http://192.168.219.109:53412/healthz
curl http://192.168.219.109:53412/ | head
```

From public internet:

```bash
curl http://124.59.225.59:53412/healthz
curl http://124.59.225.59:53412/ | head
```

If `http://124.59.225.59/` opens the router admin page, public port `80` is not
being forwarded to `zlUbuntu`. For the current staging setup, test the explicit
custom port `http://124.59.225.59:53412/` from outside the LAN, such as mobile
data.

## Notes

- Intranet IPs can change after router reboot. Set a **static DHCP lease** for
  `zlUbuntu` and keep the LAN DNS override for `pn.nacfson.cloud` in sync.
- Native release clients use only `https://pn.nacfson.cloud` (no LAN fallback
  URLs). Intranet phones rely on split DNS, not a second baked API base.
- Current deploy uses `EMAIL_PROVIDER=log` and `REQUIRE_EMAIL_VERIFIED=false`
  where that staging/dev configuration is still enabled.
