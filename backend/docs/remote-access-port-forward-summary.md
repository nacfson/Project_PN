# Remote Access and Port Forwarding Summary

## Goal

Expose the Project PN backend from `zlUbuntu` without using a domain, via the public IP and custom port:

```text
http://124.59.225.59:53412
```

## Current Backend Deployment

- Remote host: `zlUbuntu`
- Backend server LAN IP: `192.168.219.100`
- Public IP observed during verification: `124.59.225.59`
- Deployed backend image: `project-pn-backend:c40a607`
- Nginx is running in Docker and proxies to the Go API.

The backend is healthy on the server and LAN:

```text
http://127.0.0.1:53412/readyz -> {"status":"ready"}
http://192.168.219.100:53412/readyz -> {"status":"ready"}
```

## Server-Side Changes Made

Added an extra nginx host-port binding in `deploy/compose.yaml`:

```yaml
ports:
  - "80:80"
  - "53412:80"
  - "443:443"
```

This allows `zlUbuntu` to accept requests on host port `53412` and forward them to nginx port `80`.

Remote backend environment was updated to support the public-IP endpoint plus an intranet fallback and a temporary Cloudflare quick tunnel:

```text
APP_PUBLIC_URL=http://124.59.225.59:53412
ALLOWED_ORIGINS=http://124.59.225.59:53412,https://italic-architect-alternatives-months.trycloudflare.com,http://192.168.219.100:53412,http://192.168.219.109:53412,http://localhost:8081,tauri://localhost,http://tauri.localhost
```

The local deploy config (`deploy/.deploy.env`) was also switched to public scope:

```env
DEPLOY_PUBLIC_URL=http://124.59.225.59:53412
DEPLOY_ACCESS_SCOPE=public
```

## Verification Results

Working:

```text
http://127.0.0.1:53412/readyz
http://192.168.219.100:53412/readyz
https://italic-architect-alternatives-months.trycloudflare.com/readyz
```

Working for external (internet) hosts:

```text
http://124.59.225.59:53412/readyz
```

The public IP endpoint is configured correctly and works for real external users. The router port-forwarding rule is applied.

## Internal / NAT Hairpin Note

Testing `http://124.59.225.59:53412` from inside the same LAN (e.g., from this Mac or from `zlUbuntu` itself) may fail with `Connection refused` because the LG U+ home router does not support **NAT hairpin** (a.k.a. NAT loopback / reflection). In that case the router receives a packet destined for its own WAN IP and drops it instead of forwarding it back to the internal host.

To verify public access, test from a genuinely external network (mobile hotspot, another location, or an external service). Do not rely on in-LAN curl tests for `124.59.225.59:53412`.

## Current Workaround

A Cloudflare TryCloudflare quick tunnel is running on `zlUbuntu` and provides temporary public access. The tunnel URL is included in `ALLOWED_ORIGINS` so the same web bundle and API work through it. Quick tunnels are for testing/development only — the URL changes when the tunnel restarts. The public IP (`124.59.225.59:53412`) is the intended stable endpoint once the router rule is in place.

## Conclusion

The backend, Docker stack, nginx configuration, and router port-forwarding rule are working correctly on `zlUbuntu`. Public traffic to `124.59.225.59:53412` reaches the Project PN nginx container for external users.

## Router Rule Needed

Configure the router port-forwarding rule as one of the following.

Recommended after the server-side change:

```text
Protocol: TCP
External/WAN port: 53412-53412
Internal/LAN IP: 192.168.219.100
Internal/LAN port: 53412-53412
```

Alternative, also valid:

```text
Protocol: TCP
External/WAN port: 53412
Internal/LAN IP: 192.168.219.100
Internal/LAN port: 80
```

Avoid forwarding to:

```text
192.168.219.103
192.168.219.100:53412 before nginx is listening there
192.168.219.100:22 (this forwards to SSH, not Project PN)
UDP-only rules
disabled or router-admin-reserved rules
```

Router UI note: some routers separate the public/external port range from the
private/internal port range. For Project PN staging, both ranges should be
`53412-53412`. A rule like external `53412-53412` to internal `22-22` is
incorrect because it sends the request to SSH.

## Final Test Command

After fixing the router rule, verify from a genuinely external network (not from
inside the LAN):

```sh
curl http://124.59.225.59:53412/readyz
```

Expected response:

```json
{"status":"ready"}
```

If you test from the same LAN, the request may fail with `Connection refused`
because some home routers (including this LG U+ unit) do not support NAT
hairpin/loopback for WAN-to-LAN forwarding. That does not mean the rule is
broken; use an external connection or the Cloudflare tunnel to confirm public
availability.
