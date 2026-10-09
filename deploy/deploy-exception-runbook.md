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

**Cause:** API cannot reach Postgres (`DATABASE_URL` wrong, postgres pod down, or migrations not applied).

**Fix:**

```sh
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn get pods
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn logs deploy/project-pn-backend -c api --tail=100
```

Run migrate Job with current backend image if schema is behind.

---

## Word lookup returns 503 enrichment not available

**Cause:** `ENRICH_PRIMARY_API_KEY` not set on the backend (or enricher) pod.

**Fix:** Add the key in **Cursor environment secrets**, ensure it is injected into the `project-pn-backend` Deployment, then rollout restart. See [`cursor-secrets.md`](../backend/docs/cursor-secrets.md).

Wrong message vs bad key:

- `word enrichment is not available; set ENRICH_PRIMARY_API_KEY` → missing secret
- `word enrichment provider unreachable or rejected` → key present but rejected

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

**Cause:** Host nginx or ingress TLS secret expired or replaced with self-signed cert.

**Fix:** Renew LE certs on Oracle host; sync into ingress TLS secrets if required. Check issuer:

```sh
echo | openssl s_client -connect $APP_PUBLIC_URL:443 -servername $APP_PUBLIC_URL 2>/dev/null | openssl x509 -noout -issuer
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
