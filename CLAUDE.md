# Project PN Developer Guidelines

## Build & Test Commands
Run these commands from the `frontend` directory:
- Start Expo Metro Bundler: `npm run start`
- Run Web version: `npm run web`
- Run Desktop Developer version (Tauri): `npm run desktop:dev`
- Build Desktop version: `npm run desktop:build`
- Run Test Suite: `npm run test`
- Run Tests in Watch mode: `npm run test:watch`

## UI/UX Guidelines
- **Responsive Layouts**: Design screens using Flexbox layouts adapting to both mobile screen aspect ratios and desktop window sizes (default: 1000x720).
- **Theme Variables**: Reference design tokens from `frontend/src/theme/tokens.ts` for styling. Avoid hardcoded values.
- **Input Styling**: Utilize the shared `Input` component under `frontend/src/ui/Input.tsx` for form fields.
- **Translations**: Always register user-facing UI copy in both English (`en`) and Korean (`ko`) in `frontend/src/i18n/translations.ts`.
