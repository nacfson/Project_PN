---
name: build-ios-xcode
description: >-
  Build and install Project PN iOS Release from Xcode with the correct single
  API URL (https://pn.nacfson.cloud), NODE_ENV, and .xcode.env wiring. Use when
  the user builds iOS via Xcode (not npm), sees All API endpoints failed
  localhost:8080, Debug vs Release confusion, or EXPO_PUBLIC_API_BASE_URL bake-in
  issues on a physical iPhone.
---

# Build Project PN iOS from Xcode

## Goal

Ship a **Release** device build that talks to **one** API host:

`https://pn.nacfson.cloud`

Intranet access uses **split DNS** (same hostname → LAN IP on Wi‑Fi), not a second
client URL. See `deploy/NETWORK_SETUP.md`.

## Critical env (Xcode script phases)

Xcode sources, in order:

1. `frontend/ios/.xcode.env` (versioned)
2. `frontend/ios/.xcode.env.local` (local Node path / overrides)

Must be set for Release embeds:

| Variable | Required value |
|----------|----------------|
| `NODE_ENV` | `production` |
| `EXPO_PUBLIC_API_BASE_URL` | `https://pn.nacfson.cloud` |
| `EXPO_PUBLIC_CENTRAL_AUTH_URL` | `https://auth.nacfson.cloud` |

### Why `NODE_ENV` matters

If `NODE_ENV` is unset during “Bundle React Native code and images”, Expo logs:

> Using only `.env.local` and `.env`

That often bakes `http://localhost:8080` into the device app. A physical iPhone
cannot reach the Mac via localhost → login / Learn fail with
`All API endpoints failed: http://localhost:8080`.

### Do not

- Set `EXPO_PUBLIC_API_BASE_URL=` (empty) in `.env.production.local` — clears production.
- Bake `EXPO_PUBLIC_API_FALLBACK_URLS` with `192.168.x.x` into Release (cellular delay).
- Test production API behavior with **Debug** + Metro unless `.env.local` points at a
  reachable host (not localhost on device).

## Xcode steps

1. Plug in the iPhone; unlock and trust the computer.
2. Open `frontend/ios/ProjectPN.xcworkspace` (not `.xcodeproj`).
3. Scheme **Release**, run destination = **physical device**.
4. Product → Clean Build Folder.
5. Delete any older Project PN install on the phone.
6. Product → Run.

Optional one-time native regenerate:

```sh
cd frontend
EXPO_PUBLIC_API_BASE_URL=https://pn.nacfson.cloud npx expo prebuild -p ios
```

Then continue building in Xcode.

## CLI equivalent

```sh
cd frontend/ios
source .xcode.env
source .xcode.env.local
xcodebuild -workspace ProjectPN.xcworkspace -scheme ProjectPN \
  -configuration Release -destination 'generic/platform=iOS' build
```

## Verify the bake

```sh
APP=~/Library/Developer/Xcode/DerivedData/ProjectPN-*/Build/Products/Release-iphoneos/ProjectPN.app/main.jsbundle
strings $APP | grep -E 'https://pn\.nacfson\.cloud|http://localhost:8080' | sort -u
```

Expect `https://pn.nacfson.cloud`. Expect **no** `http://localhost:8080` as the API base.

## Debug vs Release

| Scheme | JS source | API URL comes from |
|--------|-----------|--------------------|
| Release | Embedded `main.jsbundle` | `.xcode.env` + production dotenv |
| Debug | Metro (`SKIP_BUNDLING=1`) | `frontend/.env.local` / Metro env |

For device + production API, prefer **Release**. For Debug on device, set
`.env.local` to `https://pn.nacfson.cloud` (or a LAN URL) and restart Metro.

## Related docs

- `deploy/NETWORK_SETUP.md` — single URL + split DNS + Xcode section
- `deploy/deploy-exception-runbook.md` — localhost:8080 symptom
- `.cursor/skills/spawn-frontend/SKILL.md` — local Expo / Tauri spawn
