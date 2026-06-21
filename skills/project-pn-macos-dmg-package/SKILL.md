---
name: project-pn-macos-dmg-package
description: Package the Project PN macOS desktop app as a Tauri DMG for direct distribution. Use when the user asks to build, package, rebuild, verify, or distribute the macOS .dmg, especially when setting EXPO_PUBLIC_API_BASE_URL to an IP/domain API endpoint and providing the macOS unidentified-developer trust command.
---

# Project PN macOS DMG Package

## Overview

Build the Project PN Expo Web + Tauri macOS app into a `.dmg`, verify that the bundled frontend points at the intended API base URL, and return the install/trust command for unsigned testing builds.

## Workflow

1. Work from the repo root:

```sh
cd /Users/hyungjuyu/Projects/iOS/Project_PN
```

2. Inspect packaging config before building:

```sh
sed -n '1,220p' frontend/package.json
sed -n '1,240p' frontend/src-tauri/tauri.conf.json
sed -n '1,120p' frontend/src/config.ts
```

3. Choose the API base URL.

- Use the URL the user provides.
- If the user says to use the current test IP and gives no newer value, use `http://124.59.225.59:53412`.
- This URL must match the backend `ALLOWED_ORIGINS` policy for Tauri. Include `tauri://localhost` and `http://tauri.localhost` on the backend for desktop builds.

4. Build the DMG from `frontend/`:

```sh
cd frontend
EXPO_PUBLIC_API_BASE_URL=http://124.59.225.59:53412 npm run desktop:build
```

Replace the URL with the selected API base URL. The command writes `frontend/dist` and `frontend/src-tauri/target`.

5. If Tauri builds the `.app` but DMG creation fails with:

```text
hdiutil: create failed - Device not configured
```

rerun only the generated DMG step with escalation, because macOS `hdiutil` needs disk-image device access outside the sandbox:

```sh
src-tauri/target/release/bundle/dmg/bundle_dmg.sh \
  --volname 'Project PN' \
  --volicon src-tauri/target/release/bundle/dmg/icon.icns \
  --icon 'Project PN.app' 128 170 \
  --app-drop-link 372 170 \
  --no-internet-enable \
  'src-tauri/target/release/bundle/dmg/Project PN_1.0.2_aarch64.dmg' \
  'src-tauri/target/release/bundle/macos'
```

Use the actual version/filename from the current build output if it differs from `1.0.2`.

6. Verify the result:

```sh
ls -lh 'src-tauri/target/release/bundle/dmg/Project PN_1.0.2_aarch64.dmg'
shasum -a 256 'src-tauri/target/release/bundle/dmg/Project PN_1.0.2_aarch64.dmg'
rg -n '124\.59\.225\.59|EXPO_PUBLIC_API_BASE_URL' dist 'src-tauri/target/release/bundle/macos/Project PN.app/Contents/Resources'
```

Adjust the `rg` pattern to match the selected API host.

7. Report the DMG path, API base URL, SHA-256, and install/trust command.

## User Install Command

For unsigned/unnotarized testing builds, provide:

```sh
sudo xattr -rd com.apple.quarantine "/Applications/Project PN.app"
open "/Applications/Project PN.app"
```

Do not suggest globally disabling Gatekeeper. Mention that signing and notarization are preferred for public distribution.
