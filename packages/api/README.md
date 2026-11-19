# `@project-pn/api` Package

## Overview
Internal monorepo workspace package (`@project-pn/api`) exposing the shared TypeScript HTTP client, backend DTO contracts, and analytics validation helpers directly from TypeScript source (`src/index.ts`) for consumption by `frontend` and `browser-extension`.

## Interface
- Package entry point and types: `"name": "@project-pn/api"`, `"main": "src/index.ts"`, `"types": "src/index.ts"` `[package.json:main]`
- Workspace scripts: `test` (`jest`), `typecheck` (`tsc --noEmit`), and `test:contract` (`jest --testPathPattern contract.e2e` gated on `CONTRACT_E2E_BASE_URL`) `[package.json:scripts]`
- Jest configuration using `ts-jest` in `node` environment rooted at `<rootDir>/src` `[jest.config.js:module.exports]`
- TypeScript strict configuration targeting `ES2022` with `DOM`, `node`, and `jest` types and `.d.ts` declaration output to `dist` `[tsconfig.json:compilerOptions]`
- [src](./src/README.md) — HTTP transport, auth/decks/words/learning-items endpoints, DTO types, and analytics validators

## Invariants
- `test:contract` refuses to execute unless `CONTRACT_E2E_BASE_URL` is non-empty (`: ${CONTRACT_E2E_BASE_URL:?CONTRACT_E2E_BASE_URL must be set}`) `[package.json:scripts]`
- Package is marked `"private": true` and has zero runtime dependencies (`devDependencies` only) so it stays platform-agnostic across React Native and Chrome extensions `[package.json:private]`

## Side Effects
- None

## Verification
- Run: `npm test -w packages/api && npm run typecheck -w packages/api`
