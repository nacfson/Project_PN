# Git branches and worktrees

## Current state (ready to merge)

| Item | Value |
|------|-------|
| Open PR | [#42](https://github.com/nacfson/Project_PN/pull/42) → `main` (**MERGEABLE**) |
| Merge branch (use this) | `cursor/google-oauth-integrated-auth-dc8c` @ `1a70d8a` |
| Agent duplicate (same tip) | `cursor/google-oauth-integrated-auth-a015` @ `1a70d8a` |
| Commits ahead of `main` | **6** (fast-forward or merge both OK) |
| Extra worktrees | **none** (only `/workspace`) |
| Stashes | **none** |

Both feature branches point at the **same commit**. Merge **only** `dc8c` via PR #42. Delete `a015` after merge.

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
