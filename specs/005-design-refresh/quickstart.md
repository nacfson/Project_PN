# Quickstart: Validating the Polished Design Refresh

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This guide proves the feature works end to end. Implementation details belong in `tasks.md`. This document only lists what to run and what you should see.

## Prerequisites

- Node 22, the Go 1.26 toolchain, and Docker with the daemon running.
- Root dependencies installed (`npm install`). After the font packages are added, run `npx expo install` inside `frontend/` once.
- `backend/.env` and `frontend/.env` exist. Copy them from the `.env.example` files if they are missing.

## 1. Start the local stack

Run each service in its own terminal. These are the standard commands from `backend/docs/go-backend-setup.md` and `GEMINI.md`.

```bash
# PostgreSQL (port 5433)
docker compose -f backend/compose.yaml --env-file backend/.env up -d

# Migrations (once)
cd backend && set -a && source .env && set +a && go run ./cmd/migrate up

# API (:8080)
cd backend && set -a && source .env && set +a && go run ./cmd/api

# Expo web (:8081)
cd frontend && npm run web
```

Sign in as the dev user: open `http://localhost:8081/?token=mock-dev-token`. Add about 16 words through Add so that Today and Practice have due cards.

## 2. Automated checks

```bash
npm test -w frontend                                   # unit + component tests
npm test -w frontend -- --testPathPattern=AddScreen    # Manual-first gate (must pass)
npm test -w frontend -- --testPathPattern=practiceItemState   # session progress vectors
npm test -w frontend -- --testPathPattern=tokens       # contrast thresholds
npm run typecheck -w frontend
npm run lint -w frontend
npm run verify:full                                    # full gate (includes serial backend tests)
```

**Expected**: everything passes with no skipped or deleted tests (SC-006).

**Static guards (SC-008, SC-011)**: these searches should return nothing once Polish is complete.

```bash
rg -n "md3Dark|bento|toggleMode|setMode\(|ThemeVariation|themeModeStorage|themeVariationStorage" frontend/src
rg -n "useState<'passage' \| 'manual'>" frontend/src/navigation/AddScreen.tsx   # must show 'manual'
```

## 3. Manual validation scenarios

Use the `local-ui-verify` workflow. Compare each screen against the matching board in [`design/`](design/) at **1440×960** (desktop browser) and **390×844** (phone emulation).

| # | Scenario | Steps | Expected outcome | Spec |
|---|---|---|---|---|
| 1 | Shell at desktop width | Open the app at 1440 px. | A left sidebar shows the "PN" mark, Today, Words, Add, Practice, Settings, and "English → Korean" at the bottom. Content is centered in a column at most 760 px wide. | FR-007, FR-010 |
| 2 | Shell at phone width | Use phone emulation at 390 px (or resize the browser below 720 px). | A bottom tab bar has five icon+label items, each at least 44 px. | FR-008 |
| 3 | Today with due words | Open Today. | Date, "16 words are due", "About 8 minutes", Start review with an Enter chip, Add a word, the glance strip (goal, streak with freezes, words with next review), Up next (5) plus "and 11 more", and the mastery bar with a 6-stage legend. | US1, FR-011–014 |
| 4 | Start with keyboard | On Today, press Enter. | A review session starts in one action. | SC-002 |
| 5 | Focus mode | Start a session. | No sidebar or tab bar. "End session", "1 of 16" and a thin progress line are shown. | FR-015 |
| 6 | Keyboard-only card | Press Space, then 3. | The answer is revealed and rated Good, and the next card appears. | SC-003 |
| 7 | Gloss-only back | Reveal any card. | Only the gloss (or "Your meaning") is shown, with no English definition or example. | FR-017 |
| 8 | Correct-only progress | Rate 3 cards Good (counter shows 4 of 16), then rate the next card Forgot. | The counter stays at 4 of 16 and the bar does not move. When the failed card returns and is rated Good, progress advances by exactly one. The bar stays below 100% until every card is answered correctly. | FR-015a–c, SC-012 |
| 9 | Phone rating row | At 390 px, reveal a card with a long gloss. | Four equal rating buttons are pinned below the card, and the gloss scrolls inside the card. | FR-019 |
| 10 | Add Manual-first | Open Add with a deck selected. | "Word or phrase" is first and selected, and the serif input is visible without a tap. | FR-021 |
| 11 | Meaning cards | Look up "resilient". | The cards show the gloss plus POS and level labels, with no definition or example. "2 found", "None of these — search again" and "Add to deck" are shown. | FR-024 |
| 12 | Words table | Open Words and press `/`, then type "late". Then choose remove on a row, choose Cancel, and repeat with Remove. | Search is focused and "latency" remains. Stage tabs show counts. At 390 px, rows show only word and stage. Remove first shows "Remove this word? This can't be undone." Cancel keeps the word, and Remove deletes it. | FR-026, FR-027, FR-028a |
| 13 | Decks view | Open Words, choose "All decks" ▾, then "Manage decks". Rename a deck, then open it. | The Decks view lists decks with counts. Opening a deck returns to Words filtered to it. | FR-029 |
| 14 | Settings | Open Settings, choose goal 300, move retention, toggle vacation, change the app language, and reload. | Every value persists with no save button. There is no Theme row. | FR-030–033 |
| 15 | Custom goal preserved | Set `daily_goal_xp` to 250 via the API, then open Settings. | Options are 100, 200, 250 (selected), 300 and 500. | FR-032 |
| 16 | OS dark mode | Set the OS or browser to dark mode and reload. | Every screen is light. Form controls, scrollbars and the status bar text are legible. | FR-033, SC-011 |
| 17 | Stale dark preference | In devtools, set `localStorage.project_pn_theme_variation = 'bentoIndigo'` and reload. | The app is light and the key has been removed. | FR-033 |
| 18 | Korean UI | Switch the app language to 한국어. | All new strings are translated, and Hangul renders in IBM Plex Sans KR with no missing glyphs. | FR-034, SC-007 |
| 19 | Fonts loading | Throttle the network to Slow 3G and hard-reload on web. | Fallback text is visible right away and swaps to Geist/Newsreader when loaded. On iOS and Android, startup behaves as it does today. | SC-009 |
| 20 | Overlays | At 1440 px, open the move-to-deck sheet and the deck filter (phone). | Sheets stay within the main page width, and only the scrim spans the window. | `DESIGN.md` |
| 21 | Tauri | Run the desktop app at the default 1000×720. | The sidebar layout is used, and the content is readable without horizontal scroll. | Edge cases |

## 4. Sign-off

- Record any visual deviations from the boards in the PR description. The expected ones are: no definition or example lines, no Theme row, a "Manage decks" entry, and stronger input borders (research R11).
- Paste the Add-tab merge checklist from `GEMINI.md` into the PR, because the Add cluster changes.
