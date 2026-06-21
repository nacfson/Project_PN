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

For the production/staging web build served by nginx, leave `EXPO_PUBLIC_API_BASE_URL` **unset** so the app resolves API calls from `window.location.origin`. This makes the same bundle work on both intranet and public IPs.

| Build Target | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|
| Local dev | `http://localhost:8080` |
| nginx-served staging/production | *(unset / empty)* |

The deploy script builds the bundle with:

```bash
cd frontend
EXPO_PUBLIC_API_BASE_URL= npm run web:export
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

- Intranet IPs are dynamic. If the router reboots, `192.168.219.100` / `192.168.219.109` may change. Set static DHCP leases in the router for a permanent setup.
- Current deploy uses `EMAIL_PROVIDER=log` and `REQUIRE_EMAIL_VERIFIED=false`. This is a staging/dev configuration.
- HTTPS is not currently enabled for public access. Port 443 is mapped but requires valid TLS certificates in `deploy/certs/`.
