# zlUbuntu → wlUbuntu Cutover Runbook

Run from the **home LAN Mac**. This cloud VM cannot reach `wlUbuntu` / `zlUbuntu`.

**Data path: FRESH.** `zlUbuntu` is unreachable; do **not** expect dumps or restore. Bootstrap empty Postgres / auth on `wlUbuntu`.

| Role | Value |
|---|---|
| Target host | `wlUbuntu` (`192.168.219.120`) |
| SSH user | `nacfson` (sudo password required) |
| ProcessManager | `~/Projects/Brain/ProcessManager` (outside this repo) |
| Project PN repo | this repo on the Mac |
| Registry | `192.168.219.120:5000` |
| Public WAN IP | `124.59.225.59` (unchanged) |

---

## 0. Preflight (Mac)

```sh
ssh wlUbuntu 'hostname -I; whoami'
# expect 192.168.219.120 and nacfson

# optional local checklist (non-destructive)
scripts/cutover-wlubuntu-checklist.sh
```

Confirm Docker Desktop is running on the Mac.

---

## 1. Bootstrap Kubernetes on wlUbuntu

Copy ProcessManager bootstrap scripts to the host, then run them **on wlUbuntu** (sudo password for `nacfson` required — passwordless sudo is not configured):

```sh
# on Mac
cd ~/Projects/Brain/ProcessManager
# Ensure REGISTRY / image refs already use 192.168.219.120:5000 before later auth deploy
rsync -a --exclude '.git' ./ wlUbuntu:~/ProcessManager/

ssh -t wlUbuntu 'bash -lc "
set -euo pipefail
cd ~/ProcessManager
sudo bash ./scripts/bootstrap-common.sh
sudo CONTROL_PLANE_IP=192.168.219.120 bash ./scripts/bootstrap-control-plane.sh
"'
```

From the Mac (with kubeconfig copied from wlUbuntu `/etc/kubernetes/admin.conf` or `/root/.kube/config`):

```sh
# copy admin kubeconfig once control plane is up
ssh wlUbuntu 'sudo cat /etc/kubernetes/admin.conf' > /tmp/wlubuntu-admin.conf
# rewrite server to https://192.168.219.120:6443 if needed, then:
export KUBECONFIG=/tmp/wlubuntu-admin.conf
cd ~/Projects/Brain/ProcessManager
./scripts/install-addons.sh
kubectl apply -f k8s/cluster/clusterissuer.yaml
kubectl get nodes
kubectl get pods -A
```

---

## 2. Retarget ProcessManager registry → `192.168.219.120:5000`

If not already pointed at wlUbuntu:

1. Set `REGISTRY` / image refs to `192.168.219.120:5000` in ProcessManager deploy scripts and k8s manifests (auth + any image pulls).
2. Confirm `deploy-auth.sh` and auth Deployment/StatefulSet image refs use that registry host:port (not zlUbuntu’s old IP).

Mac Docker must allow the insecure HTTP registry:

1. Docker Desktop → Settings → Docker Engine
2. Add to JSON:

```json
{
  "insecure-registries": ["192.168.219.120:5000"]
}
```

3. Apply & restart Docker.

Quick check from Mac:

```sh
curl -fsS http://192.168.219.120:5000/v2/ | head
```

---

## 3. Deploy central auth (ProcessManager)

From ProcessManager on the Mac (or via SSH after images are pushed):

```sh
cd ~/Projects/Brain/ProcessManager
# push/build as your ProcessManager flow expects, then:
./scripts/deploy-auth.sh
```

Bootstrap the first admin from the secret:

```sh
# on Mac or wlUbuntu with kubeconfig
kubectl apply -f k8s/auth/bootstrap-secret.yaml
# follow ProcessManager notes to create/login the bootstrap admin
# (secret lives under ProcessManager: k8s/auth/bootstrap-secret.yaml)
```

Smoke:

```sh
curl -fsS https://auth.nacfson.cloud/readyz || curl -fsS http://192.168.219.120/readyz
# exact path depends on auth ingress; prefer LAN DNS after step 5
```

---

## 4. Deploy Project PN (Compose) to wlUbuntu

### 4.1 Local deploy config

```sh
cp -n deploy/.deploy.env.example deploy/.deploy.env
# edit:
#   DEPLOY_HOST=wlUbuntu
#   DEPLOY_PUBLIC_URL=https://pn.nacfson.cloud   # or staging http://124.59.225.59:53412
#   DEPLOY_ACCESS_SCOPE=public
```

### 4.2 Compose `extra_hosts`

`deploy/compose.yaml` must resolve auth on the LAN:

```yaml
extra_hosts:
  - "auth.nacfson.cloud:192.168.219.120"
```

(Already set in-repo; do not point back at zlUbuntu `.100`.)

### 4.3 TLS certs on remote

On `wlUbuntu`, ensure:

```text
~/project-pn/deploy/certs/fullchain.pem
~/project-pn/deploy/certs/privkey.pem
```

Copy from Let’s Encrypt / previous host backup, or run `scripts/setup-ssl.sh` on wlUbuntu after DNS points here.

### 4.4 Deploy from Mac

```sh
scripts/deploy-remote.sh
```

Expect remote `/readyz` success at end of script.

Optional domain `.env` tweak on remote:

```sh
scripts/update-env-domain.sh
```

---

## 5. Network cutover checklist

Do these when auth + PN are healthy on `.120` **from the LAN**.

### LAN DNS (split DNS)

Point home LAN resolver (router / Pi-hole / AdGuard) at wlUbuntu:

```text
auth.nacfson.cloud     → 192.168.219.120
pn.nacfson.cloud       → 192.168.219.120
manager.nacfson.cloud  → 192.168.219.120
```

Public DNS for the same names stays on WAN IP `124.59.225.59` (unchanged).

### Router port forwards

Retarget internal host from zlUbuntu (`.100`) to wlUbuntu (`.120`), **same ports**:

| WAN ports | Protocol | Internal |
|---|---|---|
| `80` | TCP | `192.168.219.120:80` |
| `443` | TCP | `192.168.219.120:443` |
| `53412` | TCP | `192.168.219.120:53412` |

Give `wlUbuntu` a static DHCP lease for `.120`.

### After cutover

- Prefer testing `https://pn.nacfson.cloud` / `https://auth.nacfson.cloud` from **cellular** (no NAT hairpin on many home routers).
- On LAN Wi‑Fi, confirm split DNS:

```sh
dscacheutil -q host -a name pn.nacfson.cloud
# expect 192.168.219.120 on home LAN
```

---

## 6. Smoke tests

On wlUbuntu (always works without hairpin):

```sh
ssh wlUbuntu 'curl -fsS http://127.0.0.1:53412/readyz'
ssh wlUbuntu 'curl -fsS http://127.0.0.1:53412/healthz'
```

From Mac on LAN:

```sh
curl -fsS http://192.168.219.120:53412/readyz
curl -fsS https://pn.nacfson.cloud/readyz
curl -fsS https://auth.nacfson.cloud/readyz
```

From cellular / off-LAN:

```sh
curl -fsS https://pn.nacfson.cloud/readyz
curl -fsS http://124.59.225.59:53412/readyz
```

Auth login + PN session (browser): open `https://pn.nacfson.cloud`, sign in via central auth, confirm API calls succeed.

---

## Manual leftovers (not automatable here)

- [ ] Router WAN → `.120` for 80 / 443 / 53412
- [ ] LAN DNS A records for auth / pn / manager → `.120`
- [ ] ProcessManager bootstrap + `deploy-auth.sh` + bootstrap admin secret
- [ ] Mac Docker `insecure-registries` includes `192.168.219.120:5000`
- [ ] TLS files under `~/project-pn/deploy/certs/` on wlUbuntu

---

## Related

- `scripts/cutover-wlubuntu-checklist.sh` — local preflight
- `scripts/deploy-remote.sh` — PN Compose deploy
- `deploy/deploy-exception-runbook.md` — failure triage
- `backend/docs/remote-deploy-runbook.md` — general remote deploy
- ProcessManager (Mac): `~/Projects/Brain/ProcessManager`
