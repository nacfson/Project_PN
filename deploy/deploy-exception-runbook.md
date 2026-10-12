# Project PN Deploy Exception Runbook (Oracle Cloud)

Common failures on production ($APP_PUBLIC_URL, k3s namespace `project-pn`).

Secrets are managed via **Cursor environment secrets** — see [`backend/docs/cursor-secrets.md`](../backend/docs/cursor-secrets.md). There is no Compose `.env` on the Oracle host.

Run kubectl on the Oracle host:

```sh
ssh opc@<oracle-host>
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn ...
```

---

## `/healthz` OK but `/readyz` fails

**Cause:** API cannot reach Postgres (`DATABASE_URL` / `DB_*` wrong, postgres or vault-db-proxy down, or migrations not applied).

**Fix (Oracle legacy):**

```sh
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn get pods
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn logs deploy/project-pn-backend -c api --tail=100
```

Run migrate Job with current backend image if schema is behind (or rely on startup migrate in newer images).

**Fix (nacfson_pipeline):**

```sh
kubectl -n proj-pn get pods
kubectl -n proj-pn logs deploy/pn-backend --tail=100
kubectl -n vault get pods -l app.kubernetes.io/name=vault-db-proxy
```

Confirm `DB_HOST`/`DB_TOKEN` are set (no plaintext `DATABASE_URL` password), netpol allows egress to `vault-db-proxy`, and `/readyz` succeeds after proxy handshake.

---

## Word lookup returns 503 enrichment not available

**Cause:** `ENRICH_PRIMARY_API_KEY` not set on the backend (or enricher) pod.

**Fix:** Add the key in **Cursor environment secrets**, ensure it is injected into the `project-pn-backend` Deployment, then rollout restart. See [`cursor-secrets.md`](../backend/docs/cursor-secrets.md).

Wrong message vs bad key:

- `word enrichment is not available; set ENRICH_PRIMARY_API_KEY` → missing secret
- `word enrichment provider unreachable or rejected` → key present but rejected

---

## Frontend container never reaches the backend

**Symptom:** The frontend pod exits on startup, or the SPA loads while `/healthz`, `/readyz`, and `/api/` through the frontend return connection errors. Nginx logs `can't create /etc/nginx/conf.d/default.conf: Read-only file system` (or cannot open `/var/log/nginx/error.log` / `/run/nginx.pid`).

**Cause:** The frontend image runs with a read-only root filesystem. Those paths are on that filesystem, so nginx exits before it can proxy to `PN_BACKEND_HOST` (default `pn-backend:8080`).

**Fix:** Use a frontend image whose entrypoint renders nginx config, the pid file, and proxy temp paths under `/tmp` (or `/dev/shm` when `/tmp` is read-only). `/dev/shm` needs no extra volume. Mount an `emptyDir` on `/tmp` when proxied uploads or responses need more than the `/dev/shm` size. Set `PN_BACKEND_HOST` to the backend Service name when it is not `pn-backend`.

---

## CORS error in browser

**Cause:** `ALLOWED_ORIGINS` on the API does not include the page origin (e.g. ${APP_PUBLIC_URL}).

**Fix:** Update the value in Cursor secrets / k3s Deployment env and restart backend pods.

---

## 401 on all API routes after login

**Cause:** Platform JWT verification misconfiguration (`AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, or `AUTH_JWT_JWKS_URL`), NetworkPolicy blocking pod egress to Keycloak port 8080, or expired/invalid project access token.

**Fix:** Verify in-cluster JWKS reachability from `pn-backend` pod (`http://keycloak-service.identity.svc:8080/realms/platform/protocol/openid-connect/certs`). Ensure `deploy/projects/pn/boundary/network-policy.yaml` allows egress to `identity` namespace on port 8080. Confirm `AUTH_JWT_ISSUER` exactly matches `https://auth.nacfson.cloud/realms/platform` and `AUTH_JWT_AUDIENCE` is `project-pn`. See [`backend/docs/platform-identity-migration.md`](../backend/docs/platform-identity-migration.md).

---

## Google sign-in disabled on `auth.nacfson.cloud/login`

**Symptom:** Grey “Sign in with Google” button; hint “Google sign-in is not configured for this build.”

**Cause:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` empty in k8s (`auth-oauth-secrets` or `auth-bootstrap`).

**Fix:**

1. Add both values to **Cursor environment secrets** (not git).
2. From a Cloud Agent session with deploy SSH secrets:

```sh
echo "GOOGLE_CLIENT_ID len=${#GOOGLE_CLIENT_ID}"
echo "GOOGLE_CLIENT_SECRET len=${#GOOGLE_CLIENT_SECRET}"
./scripts/sync-auth-google-secrets.sh
```

3. Confirm `/auth/google?rd=...` returns `302` to `accounts.google.com` (not `200` HTML error).

GCP Console OAuth client must include redirect URI `https://auth.nacfson.cloud/auth/google/callback`.

---

## TLS / certificate errors

On the platform path, TLS for `pn.nacfson.cloud` terminates at Traefik in namespace `platform` (spec 008). The certificate, key and renewal are platform-owned. PN pods receive plain HTTP. See [`NETWORK_SETUP.md`](NETWORK_SETUP.md#tls-platform-owned-spec-008).

| Symptom | Cause | Fix |
|---------|-------|-----|
| Issuer is `TRAEFIK DEFAULT CERT`; browsers warn; iOS API calls fail | Platform certificate for the hostname is missing or not Ready | Escalate to the platform. Read-only check: `kubectl get certificate -n platform`. Nothing to change in PN (no cert objects belong in `proj-pn`). |
| `ERR_TOO_MANY_REDIRECTS` | An HTTP→HTTPS redirect was added inside the app (it sees `http` on the wire) | Remove the app-side redirect. Traefik already redirects. |
| `project_pn_csrf` cookie lacks `Secure` in production | `X-Forwarded-Proto: https` is not reaching `pn-backend` | Check the IngressRoute / middlewares. Do not hard-code a scheme in the app. |
| Legacy Oracle path: expired or self-signed cert | Host nginx or ingress TLS secret expired | Renew LE certs on the Oracle host; sync into ingress TLS secrets if required. |

Check the served certificate and redirect:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://pn.nacfson.cloud/
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://pn.nacfson.cloud/
echo | openssl s_client -connect pn.nacfson.cloud:443 -servername pn.nacfson.cloud 2>/dev/null | openssl x509 -noout -issuer -subject -enddate
```

---

## Image pull failures after deploy

**Cause:** Missing `ghcr-pull` imagePullSecret, wrong tag, or arm64 tag not published.

**Fix:**

```sh
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn describe pod -l app=project-pn-backend | tail -30
```

Publish arm64 via `scripts/push-ghcr.sh` or GitHub Actions workflow.

---

## Rollback

```sh
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn rollout undo deploy/project-pn-backend
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn rollout undo deploy/project-pn-frontend
```

---

## Removed legacy topics

Runbook sections for wlUbuntu Compose (`~/project-pn/deploy`, `:53412`, router NAT hairpin, `deploy-remote.sh`, migration password rotation on Compose postgres) were removed. Use k3s logs and Cursor secrets instead.
