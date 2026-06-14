---
name: spawn-frontend
description: >-
  Starts Project PN frontend (Expo web, Tauri desktop, or mobile) with the
  correct backend dependency and API URL. Use when the user asks how to run,
  start, spawn, or launch the frontend, Expo, Tauri desktop, or dev server.
---

# Spawn Project PN Frontend

## Before spawning

The frontend calls the Go API on port **8080** (`frontend/src/config.ts`). Start backend first from `backend/`:

```sh
docker compose up -d
go run ./cmd/migrate up
go run ./cmd/api
```

Verify readiness:

```sh
curl http://localhost:8080/readyz   # expect 200
```

One-time frontend deps:

```sh
cd frontend && npm install
```

## Choose a target

| Goal | Command | UI port |
|------|---------|---------|
| Browser (simplest) | `npm run web` | 8081 or 19006 |
| Desktop (Tauri) | `npm run desktop:dev` | 8081 (auto-started) |
| Mobile menu | `npm start` | Expo dev server |
| iOS simulator | `npm run ios` | — |
| Android emulator | `npm run android` | — |

All commands run from `frontend/`.

## Recommended dev layout

Use two terminals:

1. `backend/` → `go run ./cmd/api` (port 8080)
2. `frontend/` → `npm run desktop:dev` **or** `npm run web` (port 8081)

```
Expo/Tauri :8081  ──HTTP──►  Go API :8080  ──►  PostgreSQL :5433
```

## Platform-specific API URL

Default resolution (`frontend/src/config.ts`):

| Platform | API base |
|----------|----------|
| Web / Tauri / iOS simulator | `http://localhost:8080` |
| Android emulator | `http://10.0.2.2:8080` |
| Physical device | Host LAN IP |

Override for physical devices:

```sh
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8080 npm start
```

Backend CORS defaults already allow `http://localhost:8081`, `http://localhost:19006`, and Tauri origins (`backend/docs/go-backend-setup.md`).

## Tauri desktop notes

`npm run desktop:dev` runs `npx expo start --web --port 8081` then opens the native window (`frontend/src-tauri/tauri.conf.json`).

Requires Rust + Tauri toolchain: https://tauri.app/start/

## Smoke test after spawn

1. Open Capture screen
2. Paste text, tap a word → `POST /api/words/lookup`
3. Pick a sense → `POST /api/learning-items`
4. Chip shows "added" status

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Network request failed. Is the backend running?" | Start `go run ./cmd/api`; check `/readyz` |
| Lookup 503 on unknown words | Set `ENRICH_BASE_URL` + `ENRICH_API_KEY` in backend, or use cached words |
| CORS error in browser | Confirm origin is in backend `ALLOWED_ORIGINS` |
| Android emulator cannot reach API | Use default `10.0.2.2:8080` or set `EXPO_PUBLIC_API_BASE_URL` |
| `desktop:dev` fails | Install Tauri prerequisites; ensure port 8081 is free |

## Production builds (optional)

```sh
npm run desktop:build   # native Tauri binary
npm run web:export      # static bundle → frontend/dist
```
