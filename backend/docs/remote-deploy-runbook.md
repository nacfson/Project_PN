# Remote Deploy (superseded)

**Production deploy moved to Oracle Cloud k3s.**

Use these instead:

| Topic | Document |
|-------|----------|
| Oracle rollout | [`oracle-deploy-runbook.md`](oracle-deploy-runbook.md) |
| Secrets (Gemini, DB, auth) | [`cursor-secrets.md`](cursor-secrets.md) |
| GHCR publish | [`ghcr-deploy.md`](ghcr-deploy.md) |
| Agent skill | [`.cursor/skills/deploy-oracle-k8s/SKILL.md`](../../.cursor/skills/deploy-oracle-k8s/SKILL.md) |
| Network / TLS | [`deploy/NETWORK_SETUP.md`](../../deploy/NETWORK_SETUP.md) |
| Failures | [`deploy/deploy-exception-runbook.md`](../../deploy/deploy-exception-runbook.md) |

Legacy **wlUbuntu Docker Compose** deploy (`scripts/deploy-remote.sh`, `deploy/compose.yaml`, `~/project-pn/deploy/.env`, Mac merge automation) was **removed** from this repository.
