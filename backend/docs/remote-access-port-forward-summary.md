# Remote Access Summary (Oracle Cloud)

Current public access for Project PN is through an **Oracle Cloud Infrastructure (OCI) Ubuntu instance**, not a home-router port-forward to a LAN host.

## Target

| Item | Value |
|---|---|
| SSH host alias | `OracleCloud` |
| Public URL | `https://YOUR_PUBLIC_DOMAIN` or `http://YOUR_ORACLE_PUBLIC_IP:53412` |
| Deploy directory | `~/project-pn/deploy` |

Fill in the real public IP or domain in `deploy/.deploy.env` and remote `.env`.

## How traffic reaches the app

```text
Internet
  → OCI public IP
  → Security List / NSG (allow 80/443/53412)
  → Ubuntu instance
  → Docker nginx (compose)
  → Go API container
```

There is no home-router NAT hairpin issue on OCI. If public curl fails, check
OCI ingress rules and that compose/nginx is listening — see
[`deploy/deploy-exception-runbook.md`](../../deploy/deploy-exception-runbook.md).

## Required OCI ingress

Allow inbound TCP on the instance VCN security list / NSG:

- `22` SSH
- `80` / `443` production
- `53412` optional staging HTTP

## Deploy config

Local `deploy/.deploy.env`:

```env
DEPLOY_HOST=OracleCloud
DEPLOY_PUBLIC_URL=https://YOUR_PUBLIC_DOMAIN
DEPLOY_ACCESS_SCOPE=public
REMOTE_DIR='~/project-pn/deploy'
IMAGE_NAME=project-pn-backend
PLATFORM=linux/amd64
```

Remote `~/project-pn/deploy/.env` must set matching `APP_PUBLIC_URL` and
`ALLOWED_ORIGINS`.

## Verify

```sh
ssh OracleCloud 'cd ~/project-pn/deploy && docker compose --env-file .env ps'
curl -s https://YOUR_PUBLIC_DOMAIN/readyz
curl -s https://YOUR_PUBLIC_DOMAIN/healthz
```

## Historical note

Older docs referred to a home-LAN host (`zlUbuntu`, `192.168.219.x`, public IP
`124.59.225.59` via router port-forward). That path is retired. Use Oracle Cloud
+ OCI security lists instead. Full network details:
[`deploy/NETWORK_SETUP.md`](../../deploy/NETWORK_SETUP.md).
