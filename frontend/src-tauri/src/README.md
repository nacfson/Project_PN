# Tauri Rust Source (`frontend/src-tauri/src`)

## Overview
Rust entry points for the Project PN Tauri v2 native shell. Splits the shared application bootstrap into a library target (`lib.rs`) for desktop and future mobile targets, and a thin desktop executable entry point (`main.rs`).

## Interface
- `[lib.rs:run]` — public Tauri bootstrap function (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`) that configures `tauri::Builder::default()`, installs `tauri_plugin_deep_link::init()`, registers desktop deep-link schemes in `.setup(...)`, and runs `tauri::generate_context!()`.
- `[main.rs:main]` — desktop executable entry point delegating to `project_pn_lib::run()`, with `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` to hide the console window on Windows release builds.

## Invariants
- `tauri::Builder::run` unwraps via `.expect("error while running tauri application")`, terminating the process if the Tauri runtime fails to start `[lib.rs:run]`.
- Deep-link registration (`_app.deep_link().register_all()`) is compiled only on `windows` and `linux` targets, and registration failures are ignored (`let _ = ...`) so startup proceeds `[lib.rs:run]`.

## Side Effects
- Initializes `tauri_plugin_deep_link` and registers configured OS URL schemes (`projectpn://`) on Windows and Linux during Tauri setup `[lib.rs:run]`.
- Launches the native Tauri windowing and event loop runtime `[lib.rs:run]`, `[main.rs:main]`.

## Verification
- Run: `cd frontend/src-tauri && cargo check`
