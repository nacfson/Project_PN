# Git branches and worktrees

Living inventory for Project PN. Refresh this file after merges or when the Cursor agent list gets noisy.

## Current state (2026-10-01)

| Item | Value |
|------|-------|
| Default branch | `main` |
| Integration head | `cursor/integrate-unmerged-into-main-635f` folds the unmerged feature branches into one Manual-first line |
| Add-tab default | **Manual-first**. Phrase learning from #46/#49 is included; the passage-default from #49 is not |
| Folded into the integration branch | #57 S3 dump/restore, #52 60s lookup wait, #55 quiz shuffle, #46 phrase POS + add loading, #49 phrase drafts (Manual-first kept), #48 leech badge + personal gloss (includes #47 sync fix), #54 personal_note manual meaning |
| Left unmerged on purpose | #50 Manual-first-only (already on `main` via #53), #51 stale branch-inventory plan (this file is the current inventory) |
| Migration order | `000025`/`000026` stay the phrase POS retag (matches production schema v26). Leech default `tag` is `000027` |
| Local git worktrees | Prefer one checkout; see hygiene below |

**Add-tab invariant:** `AddScreen` default `activeTab === 'manual'`. See `AGENTS.md` Add-tab UI ownership. Agents must not assume Manual-first “already shipped” solely because an unmerged agent branch or Oracle image had it while `main` lagged.

## Snapshot (2026-09-07, historical)

| Item | Value |
|------|-------|
| Default branch | `main` (this worktree) |
| Open PRs | **none** (stale snapshot — refresh via `gh pr list`) |
| Remote heads | `main` only (stale) |
| Local git worktrees | **1** (`Project_PN` root on `main`) |
| Local branches | `main` only |
| Stashes | legacy WIP stashes only (no active feature branches) |
| Merged `cursor/*` remotes | pruned (`fix-translation-requirement-failures-ac9f`, `fix-ghcr-frontend-ci-4ffa`, …) |

Git remotes, local branches, and this worktree are fully organized onto `main`. Remaining clutter (if any) is **Cursor Cloud Agent sessions**, not `git worktree` checkouts.

### Cursor UI “worktrees” vs git worktrees

The branch / worktree picker in Cursor that lists many `cursor/…` names is usually **Cloud Agent sessions**, not `git worktree list`.

| Concept | How to inspect | How to clean |
|---------|----------------|--------------|
| Git remote branches | `git fetch --prune` · `git branch -r` | Delete after merge: `git push origin --delete <branch>` |
| Git worktrees | `git worktree list` | `git worktree remove <path>` · `git worktree prune` |
| Cursor agent sessions | [cursor.com/agents](https://cursor.com/agents) | **Archive** IDLE runs after their PR merges |

Archive IDLE agents so the picker collapses to `main`.

### Archive these IDLE Cloud Agents

Safe to archive (PR merged and/or branch gone from remote):

| Agent | Stale branch ref | Why |
|-------|------------------|-----|
| Google sign-in enablement (`bc-4046b880…`) | `…-dc8c` | PR #42 merged |
| Google oauth email verification (`bc-71c67d9c…`) | `…-dc8c` | Same merged work |
| Google sign-in enablement (`bc-9d9de7de…`) | (none) | Duplicate / superseded |
| Login session stability | `session-renewal-c208` | PR #40 merged |
| Deck conversion none match | `fix-none-match-…` | PR #39 merged |
| Dictionary meaning improvement | `shared-similar-meanings-…` | PR #37 merged |
| Cloudflare DNS access issue | `cloudflare-dns-docs-de34` | PR #43 merged |
| Branches worktrees structure | `organize-branches-worktrees-053b` | PR #44 merged |
| Fix GHCR frontend CI | `fix-ghcr-frontend-ci-4ffa` | PR #45 merged |

Also archive short-lived **Explore / Review / Test / Browser verify** internal runs (no branch). They do not own remotes; keeping them only clutters the agent list.

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
