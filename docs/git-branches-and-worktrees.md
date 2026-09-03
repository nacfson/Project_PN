# Git branches and worktrees

## Current state (ready to merge)

| Item | Value |
|------|-------|
| Open PR | [#42](https://github.com/nacfson/Project_PN/pull/42) → `main` (**MERGEABLE**) |
| Merge branch (only one left) | `cursor/google-oauth-integrated-auth-dc8c` @ `131d115` |
| Agent duplicate `…-a015` | **deleted** on remote (was identical tip) |
| Commits ahead of `main` | **7** |
| Git worktrees | **1** (`/workspace` on `dc8c`) |
| Stashes | **none** |

Merge **only** via PR #42 (`dc8c` → `main`).

### Cursor UI “worktrees” vs git worktrees

The branch picker that shows `main` + `cursor/google-oauth-…` entries is **Cursor Cloud Agent sessions**, not `git worktree`. Deleting a git branch does not remove those rows until you archive/kill the agent run in [Cursor Agents](https://cursor.com/agents).

Related agent runs (archive when done):

| Agent | Branch | Status |
|-------|--------|--------|
| Google sign-in enablement | `…-dc8c` | RUNNING (this cleanup session) |
| Google oauth email verification | `…-dc8c` | IDLE — safe to archive |
| Login session stability | `cursor/session-renewal-c208` | IDLE — unrelated leftover |
| Deck conversion none match | `cursor/fix-none-match-sense-picker-2527` | IDLE — unrelated leftover |
| Dictionary meaning improvement | `cursor/shared-similar-meanings-986e` | IDLE — unrelated leftover |

After merging PR #42, archive those IDLE agents and delete local/remote feature branches so the picker only shows `main`.

### Commits that land on `main`

1. `07d29bb` feat(central-auth): Google OAuth, identities, magic-link email  
2. `c719c42` docs: Google OAuth rollout and integrated accounts  
3. `6c2e17d` feat(backend): integrated accounts with link and merge APIs  
4. `e5d60d0` fix(central-auth): ProcessManager DB cutover, SMTP mailer  
5. `d6f258c` chore(deploy): sync Google OAuth secrets script  
6. `1a70d8a` docs: Google OAuth sync, central-auth rollout, branch guide  

Production is already running images from this work (`central-auth:e5d60d0`, PN `:6c2e17d`). Merging mainly syncs `main` + GHCR publish on push.

---

## Local session: merge to `main`

Run on your machine (not required in Cloud Agent):

```bash
cd /path/to/Project_PN
git fetch origin --prune

# Optional: confirm tips match
git rev-parse origin/cursor/google-oauth-integrated-auth-dc8c \
              origin/cursor/google-oauth-integrated-auth-a015
# both should print 1a70d8a820d9d74ff11ae139debb99b5ebdabf33

# Preferred: merge via GitHub UI / gh (keeps PR history)
gh pr checkout 42
gh pr merge 42 --merge   # or --squash if you prefer one commit on main

# Or local merge without gh:
git checkout main
git pull origin main
git merge --ff-only origin/cursor/google-oauth-integrated-auth-dc8c
git push origin main
```

After `main` has the commits:

```bash
# Delete remote agent duplicate and feature branch
git push origin --delete cursor/google-oauth-integrated-auth-a015
git push origin --delete cursor/google-oauth-integrated-auth-dc8c   # if PR merge did not auto-delete

# Local cleanup
git fetch origin --prune
git checkout main
git pull origin main
git branch -d cursor/google-oauth-integrated-auth-a015 2>/dev/null || true
git branch -d cursor/google-oauth-integrated-auth-dc8c 2>/dev/null || true

# Worktrees (only if you added extras locally)
git worktree list
# git worktree remove <path>   # for any non-main extra trees
```

Do **not** merge `a015` as a second PR — it is a duplicate tip of `dc8c`.

---

## Branch naming

| Branch | Purpose |
|--------|---------|
| `main` | Production line; GHCR publish on push |
| `cursor/<topic>-dc8c` | Human-initiated feature branches (canonical PR head) |
| `cursor/<topic>-a015` | Cloud Agent session forks — merge via the `dc8c` PR, then delete |

## Worktrees

Default: single worktree at repo root.

Optional second worktree for parallel `main` work:

```bash
git fetch origin main
git worktree add ../Project_PN-main origin/main
git worktree remove ../Project_PN-main   # when done
```

Do not check out the same branch in two worktrees.

## Production note (already deployed)

| Item | Value |
|------|-------|
| central-auth | `ghcr.io/nacfson/central-auth:e5d60d0` |
| PN backend/frontend | `:6c2e17d` (migration `000023` applied) |
| Google OAuth sync | `scripts/sync-auth-google-secrets.sh` |

Auth is **central-auth** in `nacfson-auth`, not ProcessManager. Magic-link `EnsureUser` still has a known production schema mismatch (`ON CONFLICT (lower(email))` vs legacy `users_email_key`) — track as a follow-up after merge if needed.
