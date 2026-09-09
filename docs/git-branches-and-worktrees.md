# Git branches and worktrees

Living inventory for Project PN. Refresh this file after merges or when the Cursor agent list gets noisy.

## Current state (2026-09-09)

| Item | Value |
|------|-------|
| Default branch | `main` |
| This worktree | `cursor/organize-branches-worktrees-42ad` (hygiene PR) |
| Local git worktrees | **1** (repo root) |
| Local branches | `main` + this organize branch |
| Stashes | none |
| Open draft PRs | **5** (see fold plan below) |
| Remote `cursor/*` heads | 5 feature heads + this organize branch (after prune) |

Git worktrees are already main-aligned (single checkout). Remaining clutter is **overlapping draft PR heads** and **IDLE Cursor Cloud Agent sessions**, not extra `git worktree` paths.

### Cursor UI “worktrees” vs git worktrees

The branch / worktree picker in Cursor that lists many `cursor/…` names is usually **Cloud Agent sessions**, not `git worktree list`.

| Concept | How to inspect | How to clean |
|---------|----------------|--------------|
| Git remote branches | `git fetch --prune` · `git branch -r` | Delete after merge: `git push origin --delete <branch>` |
| Git worktrees | `git worktree list` | `git worktree remove <path>` · `git worktree prune` |
| Cursor agent sessions | [cursor.com/agents](https://cursor.com/agents) | **Archive** IDLE runs after their PR merges |

Archive IDLE agents so the picker collapses toward `main`.

---

## Fold open drafts onto `main` (do not merge blindly)

Two independent feature lines are open. Prefer **one canonical PR head per line**, then merge that head into `main` and delete the rest.

### Line A — Practice / leech

| PR | Branch | Role |
|----|--------|------|
| **#48** (canonical) | `cursor/leech-badge-personal-gloss-cfab` | Keep: leech badge, change meaning, personal gloss (**includes #47**) |
| #47 (fold) | `cursor/fix-practice-sync-leech-cfab` | Ancestor of #48 — close after #48 lands |
| — (pruned) | `cursor/debug-practice-sync-loop-091f` | Empty net diff vs `main` — **deleted** in this hygiene pass |

### Line B — Phrases / Add screen

| PR | Branch | Role |
|----|--------|------|
| **#46** (prefer) | `cursor/phrases-and-add-loading-fb38` | Prefer: phrases + stuck-loading fix + Manual Add default (**includes #50**) + POS retag migrations |
| #49 (competing) | `cursor/phrase-add-feature-cfab` | Alternate phrase implementation — **conflicts** with #46; pick one before merge |
| #50 (fold) | `cursor/manual-add-default-tab-445a` | Ancestor of #46 — close after #46 (or chosen phrase head) lands |

**Merge hazard:** #46 and #48 both introduce a `000025_*.up.sql` migration under different filenames. Re-number before combining both lines on `main`.

**Suggested merge order into `main`:** #48 → resolve migration numbers → chosen phrase head (#46 or #49) → close folded PRs → delete remotes → archive agents.

---

### Archive these IDLE Cloud Agents

Safe to archive now (PR merged and/or branch gone from remote):

| Agent | Stale branch ref | Why |
|-------|------------------|-----|
| Pushed changes deployment | `fix-ghcr-frontend-ci-4ffa` | PR #45 merged; remote pruned |
| Branches worktrees structure | `organize-branches-worktrees-053b` | PR #44 merged |
| Cloudflare DNS access issue | `cloudflare-dns-docs-de34` | PR #43 merged |
| Google sign-in enablement (`bc-4046b880…`) | `…-dc8c` | PR #42 merged |
| Google oauth email verification (`bc-71c67d9c…`) | `…-dc8c` | Same merged work |
| Google sign-in enablement (`bc-9d9de7de…`) | (none) | Duplicate / superseded |
| Login session stability | `session-renewal-c208` | PR #40 merged |
| Deck conversion none match | `fix-none-match-…` | PR #39 merged |
| Dictionary meaning improvement | `shared-similar-meanings-…` | PR #37 merged |
| Cleanup debug instrumentation | (debug remote pruned) | Net-empty vs `main` |

Also archive short-lived **Explore / Review / Test / Browser / Demo / Verify** internal runs (no lasting branch). They do not own remotes; keeping them only clutters the agent list.

Keep (until their PR merges): agents tied to open heads `#46`–`#50` (e.g. Word phrase UI handling, Add UI manual first, Ui sync loop).

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

Default: one checkout at the repo root on `main`.

Optional parallel feature worktree while staying on `main` here:

```bash
git worktree add ../Project_PN-<topic> -b cursor/<topic>-<suffix> origin/main
git worktree remove ../Project_PN-<topic>
```

Do not check out the same branch in two worktrees.

---

## Related docs

| Topic | Doc |
|-------|-----|
| Network / Cloudflare DNS | `deploy/NETWORK_SETUP.md` |
| Oracle k3s / GHCR deploy | `backend/docs/oracle-deploy-runbook.md` |
| Cursor secrets | `backend/docs/cursor-secrets.md` |
| Google OAuth sync | `scripts/sync-auth-google-secrets.sh` |
