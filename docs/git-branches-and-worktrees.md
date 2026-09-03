# Git branches and worktrees

## Current state (ready to merge)

| Item | Value |
|------|-------|
| Open PR | [#42](https://github.com/nacfson/Project_PN/pull/42) → `main` (**MERGEABLE**) |
| Feature branch | `cursor/google-oauth-integrated-auth-dc8c` only |
| Duplicate `…-a015` | **deleted** on remote |
| Git worktrees | **1** (`/workspace` on `dc8c`) |
| Stashes | **none** |
| Remote `cursor/*` heads | only `dc8c` (plus `main`) |

Merge **only** via PR #42 (`dc8c` → `main`).

### Cursor UI “worktrees” vs git worktrees

The branch picker that shows `main` + `cursor/google-oauth-…` is **Cloud Agent sessions**, not `git worktree`. Archive IDLE runs at [cursor.com/agents](https://cursor.com/agents) after merge so the picker only shows `main`.

| Agent | Branch | Action |
|-------|--------|--------|
| Google sign-in enablement | `…-dc8c` | RUNNING — finish, then archive |
| Google oauth email verification | `…-dc8c` | IDLE — archive now |
| Login session stability | `session-renewal-c208` | IDLE — archive (unrelated) |
| Deck conversion none match | `fix-none-match-…` | IDLE — archive (unrelated) |
| Dictionary meaning improvement | `shared-similar-meanings-…` | IDLE — archive (unrelated) |

### Commits that land on `main` (feature history)

1. `07d29bb` feat(central-auth): Google OAuth, identities, magic-link email  
2. `c719c42` docs: Google OAuth rollout and integrated accounts  
3. `6c2e17d` feat(backend): integrated accounts with link and merge APIs  
4. `e5d60d0` fix(central-auth): ProcessManager DB cutover, SMTP mailer  
5. `d6f258c` chore(deploy): sync Google OAuth secrets script  
6. `1a70d8a` docs: Google OAuth sync, central-auth rollout, branch guide  
7. `131d115` docs: local merge checklist for PR #42  
8. `a654058`+ docs: Cursor agent worktrees vs git; a015 deleted  

Production already runs `central-auth:e5d60d0` and PN `:6c2e17d`. Merging syncs `main` and triggers GHCR publish.

---

## Local session: merge to `main`

```bash
cd /path/to/Project_PN
git fetch origin --prune

# Preferred
gh pr checkout 42
gh pr merge 42 --merge   # or --squash

# Or local ff-only
git checkout main
git pull origin main
git merge --ff-only origin/cursor/google-oauth-integrated-auth-dc8c
git push origin main
```

After merge:

```bash
git push origin --delete cursor/google-oauth-integrated-auth-dc8c 2>/dev/null || true
git fetch origin --prune
git checkout main && git pull origin main
git branch -d cursor/google-oauth-integrated-auth-dc8c 2>/dev/null || true

# Archive IDLE Cloud Agents at https://cursor.com/agents
```

---

## Branch naming

| Branch | Purpose |
|--------|---------|
| `main` | Production line; GHCR publish on push |
| `cursor/<topic>-dc8c` | Canonical feature / PR head |
| `cursor/<topic>-a015` | Agent forks — delete after folding into the PR head |

## Worktrees

Default: one checkout at repo root. Optional parallel `main`:

```bash
git worktree add ../Project_PN-main origin/main
git worktree remove ../Project_PN-main
```

Do not check out the same branch in two worktrees.

## Production note

| Item | Value |
|------|-------|
| central-auth | `ghcr.io/nacfson/central-auth:e5d60d0` |
| PN images | `:6c2e17d` (migration `000023`) |
| Google OAuth sync | `scripts/sync-auth-google-secrets.sh` |

Follow-up: magic-link `EnsureUser` fails on production auth DB (`ON CONFLICT (lower(email))` vs legacy `users_email_key`). Google OAuth path is fine.
