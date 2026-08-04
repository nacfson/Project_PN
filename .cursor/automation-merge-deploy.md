# Cursor Automation: deploy on PR merge (local worker)

Use this when creating an automation at [cursor.com/automations](https://cursor.com/automations).
Development runs in **Cursor Cloud**; production deploy runs on your **Mac** via **My Machines**.

## Automation settings

| Field | Value |
|-------|--------|
| Name | Deploy PN on main merge (local) |
| Repository | This repo, branch `main` |
| Trigger | Git → **Pull request merged** |
| Runtime | **My Machine** / self-hosted worker (`project-pn-mac` or your worker name) — not Cursor Cloud VM |
| Tools | Terminal only; disable PR creation and file edits |

Confirm **Dashboard → Cloud Agents** shows your worker after `scripts/start-cursor-worker.sh`.

## Instructions (paste into automation prompt)

```text
You deploy Project PN on the local Mac worker only. Do not edit files, commit, or open PRs.

1. cd to the repository root (worker-dir).
2. git fetch origin main && git checkout main && git pull origin main
3. Run: scripts/deploy-on-merge.sh
   (It skips deploy when the merge did not touch backend/, frontend/, deploy/, or deploy scripts.)
4. If deploy ran, confirm output includes [deploy] deployed project-pn-backend:
5. On success run: curl -fsS https://pn.nacfson.cloud/readyz
6. On failure, show the last 50 lines of script output and stop.

Do not run deploy from a cloud VM. Do not install Tailscale or change SSH config.
```

## Manual test (before enabling merge trigger)

```sh
# Terminal 1
scripts/start-cursor-worker.sh

# Terminal 2 — on main after a test merge or with DEPLOY_SKIP_PATH_CHECK=1
git checkout main && git pull origin main
scripts/deploy-on-merge.sh --check-only
# Full deploy (only when intended):
# scripts/deploy-remote.sh
```

## Fallback

If your plan does not offer **My Machine** as the automation runtime, use a **GitHub Actions self-hosted runner** on the Mac that runs `scripts/deploy-on-merge.sh` on `push` to `main` after merge. See `backend/docs/remote-deploy-runbook.md` § Cursor merge deploy.
