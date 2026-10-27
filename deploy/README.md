# Deploy Docs (Oracle Cloud)

Production runs on **Oracle Cloud k3s**, not Docker Compose.

| File | Purpose |
|------|---------|
| [`../backend/docs/oracle-deploy-runbook.md`](../backend/docs/oracle-deploy-runbook.md) | GHCR publish + k3s rollout on Oracle |
| [`../backend/docs/cursor-secrets.md`](../backend/docs/cursor-secrets.md) | Runtime secrets via Cursor environment secrets |
| [`../backend/docs/db-s3-migration.md`](../backend/docs/db-s3-migration.md) | Dump/restore Postgres values through AWS S3 |
| [`../backend/docs/ghcr-deploy.md`](../backend/docs/ghcr-deploy.md) | GHCR image publishing details |
| [`NETWORK_SETUP.md`](NETWORK_SETUP.md) | Kubernetes (nacfson_pipeline) networking and TLS |
| [`deploy-exception-runbook.md`](deploy-exception-runbook.md) | Common production failures |

## Quick commands

Publish images in GitHub Actions cloud session (automatic on push to `main`, or triggered on demand):

```sh
scripts/push-ghcr.sh --watch
```

Deploy skill for agents: [`.cursor/skills/deploy-oracle-k8s/SKILL.md`](../.cursor/skills/deploy-oracle-k8s/SKILL.md)

## Removed (legacy)

The following **wlUbuntu / Compose** artifacts were removed from this repo:

- `scripts/deploy-remote.sh`, `deploy/compose.yaml`, `deploy/.env.example`
- `deploy/.deploy.env.example`, `deploy/migrate-to-wlubuntu.md`
- `.cursor/skills/deploy-web-ubuntu`, `.cursor/skills/update-backend-image`
- Mac merge-deploy automation for Compose (`deploy-on-merge.sh`)

Do not recreate host-level `~/project-pn/deploy/.env` for production. Use Cursor secrets + k3s.
