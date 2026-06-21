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

Remote backend environment was updated to use the public-IP endpoint:

```text
ALLOWED_ORIGINS=http://124.59.225.59:53412,http://localhost:8081
APP_PUBLIC_URL=http://124.59.225.59:53412
```

## Verification Results

Working:

```text
http://127.0.0.1:53412/readyz
http://192.168.219.100:53412/readyz
```

Not working yet:

```text
http://124.59.225.59:53412/readyz
```

External checker nodes reported:

```text
Connection reset by peer
```

Nginx logs showed LAN requests, but no successful external requests from the public checkers.

## Conclusion

The backend, Docker stack, and nginx configuration are working correctly on `zlUbuntu`.

The remaining issue is router/WAN forwarding. Public traffic to `124.59.225.59:53412` is not reaching the Project PN nginx container correctly.

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

After fixing the router rule, verify from outside the LAN:

```sh
curl http://124.59.225.59:53412/readyz
```

Expected response:

```json
{"status":"ready"}
```
