# Tauri Desktop Shell (`frontend/src-tauri`)

## Overview
Tauri v2 native desktop wrapper crate (`project-pn`, bundle identifier `com.projectpn.app`) that hosts the Project PN Expo web frontend inside a native webview window, configures the `projectpn://` deep-link scheme, and declares macOS Services menu integration.

## Interface
- `[Cargo.toml:package]` — Cargo manifest for crate `project-pn` (edition `2021`), library target `project_pn_lib` (`staticlib`, `cdylib`, `rlib`), dependencies (`tauri` v2, `tauri-plugin-deep-link` v2, `serde`, `serde_json`), build dependency `tauri-build` v2, and size-optimized release profile (`panic = "abort"`, `codegen-units = 1`, `lto = true`, `opt-level = "s"`, `strip = true`).
- `[build.rs:main]` — build script invoking `tauri_build::build()` to generate Tauri compile-time context and bundle glue.
- `[tauri.conf.json:build]` — frontend integration hooks (`frontendDist: "../dist"`, `devUrl: "http://localhost:8081"`, `beforeDevCommand: "npx expo start --web --port 8081"`, `beforeBuildCommand: "npx expo export --platform web"`).
- `[tauri.conf.json:app]` — defines the `main` window (`title: "Project PN"`, `theme: "Light"`, `1000x720`, minimum `420x560`, `resizable: true`) and disables Tauri CSP (`security.csp: null`).
- `[tauri.conf.json:plugins]` — configures the `deep-link` plugin with scheme `projectpn` for desktop and mobile (`appLink: false`).
- `[tauri.conf.json:bundle]` — enables active bundling for `"all"` targets, references `Info.plist` on macOS, and registers app icons under `icons/`.
- `[Info.plist:NSServices]` — registers the macOS Services menu entry `"Translate & Add to Vocabulary Tracker"` (`NSMessage: translateAndAdd`, `NSPortName: Project PN`) accepting `NSStringPboardType` and `public.utf8-plain-text` payloads.
- Child directory: [src](./src/README.md) — Rust library and binary entry points (`lib.rs`, `main.rs`).

## Invariants
- Development and production Tauri builds expect the Expo web dev server on `http://localhost:8081` and static web exports in `../dist` `[tauri.conf.json:build]`.
- The main window cannot be resized below `420x560` and runs with `security.csp` set to `null` `[tauri.conf.json:app]`.
- Release builds use `panic = "abort"` with LTO and symbol stripping `[Cargo.toml:profile.release]`.

## Side Effects
- Executes `tauri_build::build()` during Cargo compilation `[build.rs:main]`.
- Invokes external Node/Expo commands (`npx expo start --web --port 8081` and `npx expo export --platform web`) via Tauri CLI lifecycle hooks `[tauri.conf.json:build]`.
- Registers the `projectpn://` custom URL scheme and macOS Services menu handler when packaged/installed `[tauri.conf.json:plugins]`, `[Info.plist:NSServices]`.

## Verification
- Run: `cd frontend/src-tauri && cargo check`
