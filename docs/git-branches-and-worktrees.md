# Git branches and worktrees

## Branch naming

| Branch | Purpose |
|--------|---------|
| `main` | Production line; GHCR publish on push |
| `cursor/<topic>-dc8c` | Human-initiated feature branches (e.g. integrated accounts PR #42) |
| `cursor/<topic>-a015` | Cloud Agent session branches (same work, agent suffix) |

Cloud Agents create `cursor/<descriptive-name>-a015` off `main` or an existing feature branch. When continuing integrated-auth work, branch from `cursor/google-oauth-integrated-auth-dc8c` or its agent fork `cursor/google-oauth-integrated-auth-a015`.

## Worktrees

Default: single worktree at repo root on the active feature branch.

Optional second worktree for parallel `main` work without stashing:

```bash
git fetch origin main
git worktree add ../Project_PN-main origin/main
# work in ../Project_PN-main; remove when done:
git worktree remove ../Project_PN-main
```

Do not check out the same branch in two worktrees.

## Integrated accounts + Google OAuth (current)

| Item | Value |
|------|-------|
| Feature branch (PR #42) | `cursor/google-oauth-integrated-auth-dc8c` |
| Cloud Agent branch | `cursor/google-oauth-integrated-auth-a015` (tracks same commits + doc follow-ups) |
| central-auth image | `ghcr.io/nacfson/central-auth:e5d60d0` |
| PN images | `ghcr.io/nacfson/project-pn-backend:6c2e17d`, `project-pn-frontend:6c2e17d` |
| Google OAuth sync | `scripts/sync-auth-google-secrets.sh` after Cursor secrets |

Production auth is **central-auth** in `nacfson-auth`, not ProcessManager.

## Cleanup

```bash
git stash list          # drop stale stashes: git stash drop stash@{n}
git worktree list       # remove extra worktrees before deleting branches
git branch -vv          # confirm upstream tracking
```
