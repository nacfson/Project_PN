# Frontend Nginx Runtime

## Overview
Container entrypoint and Nginx reverse-proxy configuration for serving the exported Project PN Expo web SPA (`/usr/share/nginx/web`) and proxying API and health requests to the Go backend. The entrypoint builds its active configuration and temporary directories inside a writable runtime path (`/tmp/nginx` or `/dev/shm/nginx`) so the container operates under read-only root filesystems (such as Kubernetes `readOnlyRootFilesystem` or `docker --read-only`).

## Interface
- `[docker-entrypoint.sh:PN_BACKEND_HOST]` — backend upstream hostname environment variable (defaults to `pn-backend` when unset or empty).
- `[docker-entrypoint.sh:PN_BACKEND_PORT]` — backend upstream port environment variable (defaults to `8080` when unset or empty).
- `[docker-entrypoint.sh:SERVICE_VERSION]` — service version embedded in structured JSON access logs (defaults to `v0.0.0` when unset or empty).
- `[docker-entrypoint.sh:render_server_conf]` — expands `${PN_BACKEND_HOST}` and `${PN_BACKEND_PORT}` in `/etc/nginx/templates/default.conf.template` via `envsubst`.
- `[docker-entrypoint.sh:can_write_dir]` — write-probes a candidate directory using a temporary `.pn-nginx-write-test` file.
- `[docker-entrypoint.sh:pick_runtime_dir]` — selects `/tmp/nginx` or `/dev/shm/nginx`, creates Nginx config and temp subdirectories, and prints the chosen runtime directory path.
- `[default.conf.template:server]` — port `80` virtual host serving `/usr/share/nginx/web` (`index index.html`) with routes:
  - `location = /healthz` and `location = /readyz` proxied to `http://${PN_BACKEND_HOST}:${PN_BACKEND_PORT}` with W3C `traceparent` propagation.
  - `location /api/` proxied to `http://${PN_BACKEND_HOST}:${PN_BACKEND_PORT}` with `60s` read/send timeouts and `traceparent` propagation.
  - `location ^~ /_expo/static/` serving content-hashed static bundles with `Cache-Control: public, max-age=31536000, immutable` (`try_files $uri =404`).
  - `location /` serving SPA routes with `Cache-Control: no-cache` and fallback `try_files $uri $uri/ /index.html`.

## Invariants
- Shell execution uses `set -eu`, failing immediately on any command failure or unset variable `[docker-entrypoint.sh:set]`.
- Empty values for `PN_BACKEND_HOST`, `PN_BACKEND_PORT`, and `SERVICE_VERSION` are treated identically to unset variables and normalized to defaults `[docker-entrypoint.sh:PN_BACKEND_HOST]`.
- Startup aborts with exit code `1` and an error on stderr if neither `/tmp` nor `/dev/shm` is writable `[docker-entrypoint.sh:pick_runtime_dir]`.
- When invoked with `$1 = nginx`, the script bypasses the stock Nginx entrypoint and executes `nginx -c "$RUNTIME/nginx.conf"` directly so PID, log, and temp paths never target the read-only root filesystem `[docker-entrypoint.sh:exec]`.
- Content-hashed `/_expo/static/` assets are cached immutably (`max-age=31536000, immutable`), whereas `/` and SPA fallback responses always require revalidation (`no-cache`) `[default.conf.template:server]`.

## Side Effects
- Reads and exports `PN_BACKEND_HOST`, `PN_BACKEND_PORT`, and `SERVICE_VERSION` from the container environment `[docker-entrypoint.sh:PN_BACKEND_HOST]`.
- Probes writability with `.pn-nginx-write-test`, creates `$RUNTIME/{conf.d,client_temp,proxy_temp,fastcgi_temp,uwsgi_temp,scgi_temp}`, sets ownership to `nginx:nginx` (when the `nginx` user exists) and permissions (`755` for runtime/`conf.d`, `1777` for temp directories) `[docker-entrypoint.sh:pick_runtime_dir]`.
- Writes rendered server config to `$RUNTIME/conf.d/default.conf` (and to `/etc/nginx/conf.d/default.conf` if writable) and writes the main `$RUNTIME/nginx.conf` `[docker-entrypoint.sh:render_server_conf]`.
- Replaces the shell process via `exec` to launch `nginx` or the caller-supplied command `[docker-entrypoint.sh:exec]`.
- Emits JSON-escaped `contract` access logs (`service.name: "pn-web"`) to `/dev/stdout`, notice-level error logs to `/dev/stderr`, and forwards HTTP traffic with synthesized `traceparent` headers to the configured backend `[docker-entrypoint.sh:nginx.conf]`, `[default.conf.template:server]`.

## Verification
- Run: `npm run web:export -w frontend`
