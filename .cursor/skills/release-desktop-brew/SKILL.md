---
name: release-desktop-brew
description: >-
  Build the Project PN desktop app (Tauri, Apple Silicon) and release a new
  version through the Homebrew cask. Use when the user asks to build, release,
  publish, distribute, ship, or update the desktop app via brew / Homebrew, cut
  a new desktop version, or bump the project-pn cask.
---

# Release Project PN Desktop to Homebrew

Builds the Tauri desktop app, publishes a GitHub release, and updates the
Homebrew cask so `brew upgrade --cask project-pn` pulls the new version.

## Facts

| Thing | Value |
|-------|-------|
| App repo | `nacfson/Project_PN` (releases tagged `vX.Y.Z`) |
| Tap repo | `nacfson/homebrew-tap` (`brew tap nacfson/tap`) |
| Cask file | `.tmp/homebrew-tap/Casks/project-pn.rb` (separate git repo) |
| Build dir | `frontend/` |
| dmg output | `frontend/src-tauri/target/**/bundle/dmg/*.dmg` |
| Asset name | `Project-PN-${VERSION}-arm64.dmg` (cask `url` is templated on `version`) |
| Arch | Apple Silicon only (`arm64`/`aarch64`); app is **unsigned** |

Prereqs: Rust + Tauri toolchain, `gh` authenticated. The Tauri release build runs
several minutes; run it outside the sandbox (full permissions, network).

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. Commit pending app changes (stage explicitly)
- [ ] 2. Bump version in tauri.conf.json + package.json
- [ ] 3. Build: npm run desktop:build
- [ ] 4. Locate dmg, ensure name Project-PN-${VERSION}-arm64.dmg
- [ ] 5. VERIFY the intended change shipped in the built bundle
- [ ] 6. sha256 of the dmg
- [ ] 7. Push main + gh release create
- [ ] 8. Update cask (version + sha256)
- [ ] 9. Commit + push tap
- [ ] 10. VERIFY published digest == cask sha256
```

Set `VERSION` once, e.g. `VERSION=1.0.2`.

### 1. Commit pending changes
The working tree often has unrelated tracked changes (deploy/, .gitignore, etc.).
**Stage files explicitly — never `git commit -am`** so unrelated changes aren't swept in.

```bash
cd <repo-root>
git add <only the relevant files>
git commit -m "<concise message>"
```

### 2. Bump version (both files, drives the dmg filename)
- `frontend/src-tauri/tauri.conf.json` -> `"version": "${VERSION}"`
- `frontend/package.json` -> `"version": "${VERSION}"`

```bash
git commit frontend/src-tauri/tauri.conf.json frontend/package.json -m "Bump desktop app version to ${VERSION}"
```

### 3. Build (long)
```bash
cd frontend && npm run desktop:build   # expo export web + tauri build
```
If plain build doesn't produce an arm64 dmg: `npx tauri build --target aarch64-apple-darwin`.

### 4. Locate / rename dmg
Tauri writes the final dmg to `src-tauri/target/**/bundle/dmg/`. The expected name is
`Project-PN-${VERSION}-arm64.dmg`. If Tauri emitted `Project PN_${VERSION}_aarch64.dmg`,
copy it to the expected name.

```bash
DMG=$(find src-tauri/target -path "*/bundle/dmg/*.dmg" | head -1)
cp "$DMG" "src-tauri/target/$(dirname "${DMG#*target/}")/Project-PN-${VERSION}-arm64.dmg"
```

### 5. Verify the change shipped (gate — do NOT publish if this fails)
Confirm the intended code is actually in the exported web bundle. Example for the
WKWebView style fix:
```bash
grep -rl "rnw-webkit-style-mirror" frontend/dist/_expo/static/js/web/
```
For other changes, grep for a unique string from the change.

### 6. sha256
```bash
shasum -a 256 "<path>/Project-PN-${VERSION}-arm64.dmg"
```

### 7. Push main + create release
```bash
git push origin main
gh release create v${VERSION} -R nacfson/Project_PN --target main \
  --title "Project PN v${VERSION}" \
  --notes "<what changed>" \
  "<path>/Project-PN-${VERSION}-arm64.dmg"
```

### 8. Update the cask
Edit `.tmp/homebrew-tap/Casks/project-pn.rb`: set `version "${VERSION}"` and
`sha256 "<sha from step 6>"`. Leave the `url` line (it interpolates `#{version}`).

### 9. Commit + push tap
```bash
cd .tmp/homebrew-tap
git commit -am "Update Project PN to v${VERSION}"
git push origin main
```

### 10. Final verification (gate)
```bash
gh release view v${VERSION} -R nacfson/Project_PN --json assets
```
Confirm the asset is `Project-PN-${VERSION}-arm64.dmg` and its `digest` matches the
cask `sha256`. Users get it via `brew upgrade --cask project-pn`.

## Notes
- Build verification of UI styling can only be emulated headlessly; real WKWebView
  appearance should be eye-checked via `npm run desktop:dev` (from `frontend/`).
- Releasing reuses the same `version` cleanly only if you bump it — never overwrite
  an existing published tag/asset.
