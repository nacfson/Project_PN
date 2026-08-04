# Deploy Docs

Documentation for deploying Project PN to **Oracle Cloud**.

| File | Purpose |
|---|---|
| [`NETWORK_SETUP.md`](NETWORK_SETUP.md) | Oracle Cloud / OCI networking and nginx setup |
| [`deploy-exception-runbook.md`](deploy-exception-runbook.md) | Common deploy failures and fixes |
| [`.deploy.env.example`](.deploy.env.example) | Local Mac deploy-script settings (`DEPLOY_HOST=OracleCloud`) |

Full stack deploy (web + backend image): `scripts/deploy-remote.sh`  
Backend image only: `scripts/update-backend-image.sh` (see `.cursor/skills/update-backend-image/SKILL.md`)

For the full deploy procedure, see [`backend/docs/remote-deploy-runbook.md`](../backend/docs/remote-deploy-runbook.md).

See also [`docs/GUIDE.md`](../docs/GUIDE.md) for the full project documentation map.
