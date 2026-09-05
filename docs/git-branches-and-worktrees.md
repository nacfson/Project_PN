# Git branches and worktrees

Living inventory for Project PN. Refresh this file after merges or when the Cursor agent list gets noisy.

## Current state (2026-09-05)

| Item | Value |
|------|-------|
| Default branch | `main` @ `48cd23b` (includes merged PR #42 Google OAuth) |
| Open PRs | [#43](https://github.com/nacfson/Project_PN/pull/43) draft — Cloudflare DNS docs |
| Remote heads | `main`, `cursor/cloudflare-dns-docs-de34` only |
| Local git worktrees | **1** (`/workspace` on whatever branch this checkout uses) |
| Stashes | none |
| Merged `cursor/*` remotes | already pruned (no leftovers from PRs #1–#42) |

Git side is clean. Remaining clutter is **Cursor Cloud Agent sessions**, not `git worktree` checkouts.

### Active work

| Branch | PR | Agent | Notes |
|--------|-----|-------|-------|
| `cursor/cloudflare-dns-docs-de34` | [#43](https://github.com/nacfson/Project_PN/pull/43) (draft) | [Cloudflare DNS access issue](https://cursor.com/agents/bc-d0f69ec1-1b05-4b70-89f5-aea20ab7de34) | Keep until merged |
| `cursor/organize-branches-worktrees-053b` | this doc refresh | [Branches worktrees structure](https://cursor.com/agents/bc-daef05ff-0565-47cd-a72e-89eb7c26053b) | Ephemeral hygiene PR |

### Cursor UI “worktrees” vs git worktrees

The branch / worktree picker in Cursor that lists many `cursor/…` names is usually **Cloud Agent sessions**, not `git worktree list`.

| Concept | How to inspect | How to clean |
|---------|----------------|--------------|
| Git remote branches | `git fetch --prune` · `git branch -r` | Delete after merge: `git push origin --delete <branch>` |
| Git worktrees | `git worktree list` | `git worktree remove <path>` · `git worktree prune` |
| Cursor agent sessions | [cursor.com/agents](https://cursor.com/agents) | **Archive** IDLE runs after their PR merges |

Archive IDLE agents so the picker collapses toward `main` plus in-flight feature branches.

### Archive these IDLE Cloud Agents

Safe to archive (branch gone from remote and/or PR already merged):

| Agent | Stale branch ref | Why |
|-------|------------------|-----|
| Google sign-in enablement (`bc-4046b880…`) | `…-dc8c` | PR #42 merged |
| Google oauth email verification (`bc-71c67d9c…`) | `…-dc8c` | Same merged work |
| Google sign-in enablement (`bc-9d9de7de…`) | (none) | Duplicate / superseded |
| Login session stability | `session-renewal-c208` | PR #40 merged |
| Deck conversion none match | `fix-none-match-…` | PR #39 merged |
| Dictionary meaning improvement | `shared-similar-meanings-…` | PR #37 merged |

Also archive short-lived **Explore / Review / Test / Browser verify** internal runs (no branch). They do not own remotes; keeping them only clutters the agent list. Keep only agents you still chat with.

Keep (do not archive yet):

| Agent | Branch |
|-------|--------|
| Cloudflare DNS access issue | `cursor/cloudflare-dns-docs-de34` |
| Branches worktrees structure (this run) | `cursor/organize-branches-worktrees-053b` |

---

## Hygiene commands

```bash
cd /path/to/Project_PN
git fetch origin --prune
git worktree list
git worktree prune
git branch -vv
git branch -r --merged origin/main    # candidates to delete (except main)
gh pr list --state open
```

After a PR merges:

```bash
git push origin --delete <merged-feature-branch> 2>/dev/null || true
git fetch origin --prune
git checkout main && git pull origin main
git branch -d <merged-feature-branch> 2>/dev/null || true
# Then archive the matching Cloud Agent at https://cursor.com/agents
```

---

## Branch naming

| Pattern | Purpose |
|---------|---------|
| `main` | Production line; GHCR publish on push |
| `cursor/<topic>-<suffix>` | Cloud Agent / PR head (suffix from agent id fragment) |
| Duplicate agent forks of the same topic | Fold into the canonical PR head, then delete the extra remote |

Do not leave merged `cursor/*` branches on `origin`. Prefer one open PR head per feature.

## Worktrees

Default: one checkout at the repo root.

Optional parallel `main` while a feature is checked out:

```bash
git worktree add ../Project_PN-main origin/main
git worktree remove ../Project_PN-main
```

Do not check out the same branch in two worktrees.

---

## Related docs

| Topic | Doc |
|-------|-----|
| Network / Cloudflare DNS (PR #43) | `deploy/NETWORK_SETUP.md` |
| Oracle k3s / GHCR deploy | `backend/docs/oracle-deploy-runbook.md` |
| Cursor secrets | `backend/docs/cursor-secrets.md` |
| Google OAuth sync | `scripts/sync-auth-google-secrets.sh` |
