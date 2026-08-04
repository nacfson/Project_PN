# Project_PN Network Setup

Current deployment target is an **Oracle Cloud Infrastructure (OCI) Ubuntu instance**.

The frontend is a static Expo web bundle served by nginx. API routes are proxied to the Go backend.

SSH host alias used in docs and deploy scripts: `OracleCloud` (set this in `~/.ssh/config`).

## Server Addresses

| Type | Address | Notes |
|---|---|---|
| SSH host | `OracleCloud` | Local SSH config alias |
| Public IP / domain | `YOUR_ORACLE_PUBLIC_IP` or `https://YOUR_PUBLIC_DOMAIN` | OCI VCN public IP or DNS |
| Public API URL | `https://YOUR_PUBLIC_DOMAIN` or `http://YOUR_ORACLE_PUBLIC_IP:53412` | nginx → backend |

Replace placeholders with your instance’s real public IP or domain before deploy.

## Backend Configuration

File: `~/project-pn/deploy/.env`

```bash
APP_PUBLIC_URL=https://YOUR_PUBLIC_DOMAIN
ALLOWED_ORIGINS=https://YOUR_PUBLIC_DOMAIN,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

For HTTP staging on a custom port:

```bash
APP_PUBLIC_URL=http://YOUR_ORACLE_PUBLIC_IP:53412
ALLOWED_ORIGINS=http://YOUR_ORACLE_PUBLIC_IP:53412,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

## Nginx Ports

From `compose.yaml`:

- `80:80` → HTTP
- `443:443` → HTTPS (requires certs under `deploy/certs/`)
- `53412:80` → Optional staging access on a non-standard port

## Oracle Cloud networking (required)

OCI does **not** use a home-router port-forward. Open ingress on the instance VCN:

1. **Security List** and/or **Network Security Group** attached to the instance VNIC
2. Allow inbound TCP from the internet (or your admin CIDR) for the ports you expose:
   - `22` (SSH)
   - `80` / `443` (production HTTPS)
   - `53412` (optional staging HTTP)
3. Confirm the subnet route table has an Internet Gateway for public ingress
4. Confirm the instance has a public IP (or use a load balancer / DNS in front)

Example security-list ingress (CIDR `0.0.0.0/0` only if you intend public access):

```text
TCP 22
TCP 80
TCP 443
TCP 53412   # optional staging
```

## Frontend Base URLs

For the production/staging web build served by nginx, leave `EXPO_PUBLIC_API_BASE_URL` **unset** so the app resolves API calls from `window.location.origin`.

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

nginx serves static files from `~/project-pn/deploy/web/` (mounted at `/usr/share/nginx/web` in the container).

Files are uploaded by `scripts/deploy-remote.sh` after `npm run web:export`.

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
| Ready check | GET | `/readyz` |
| Me | GET | `/api/auth/me` |
| Lookup word | POST | `/api/words/lookup` |
| Add learning item | POST | `/api/learning-items` |
| Curriculum packs | GET | `/api/curriculum/packs` |
| Enroll curriculum pack | POST | `/api/curriculum/packs/{slug}/enroll` |

Full example:

```bash
curl -X GET https://YOUR_PUBLIC_DOMAIN/healthz
curl -X GET https://YOUR_PUBLIC_DOMAIN/api/curriculum/packs \
  -H "Authorization: Bearer <token>"
```

## How to Update CORS Origins

1. Edit `~/project-pn/deploy/.env`.
2. Update `ALLOWED_ORIGINS` with the new origin.
3. Restart the API container:

```bash
ssh OracleCloud
cd ~/project-pn/deploy
docker compose up -d --no-deps api nginx
```

## Testing

From the server:

```bash
ssh OracleCloud
curl http://localhost:53412/healthz
curl http://localhost:53412/ | head
# or, if using 80/443:
curl http://localhost/healthz
```

From the public internet:

```bash
curl https://YOUR_PUBLIC_DOMAIN/healthz
curl https://YOUR_PUBLIC_DOMAIN/ | head
# HTTP staging example:
curl http://YOUR_ORACLE_PUBLIC_IP:53412/healthz
```

## Notes

- Prefer HTTPS + domain for production (`APP_PUBLIC_URL=https://…`).
- If `deploy/compose.yaml` still contains a home-LAN `extra_hosts` entry for `auth.nacfson.cloud`, remove or replace it on Oracle Cloud so central auth resolves via public DNS.
- TLS for port 443 requires valid certificate files in `~/project-pn/deploy/certs/`.
- Historical home-LAN (`zlUbuntu` / `192.168.219.x`) notes live in older revision history; they are not the current target.
