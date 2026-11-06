# Contract: Design Tokens

**Owner module**: `frontend/src/theme/tokens.ts`, exposed through `useTheme()`
**Consumers**: every screen and `src/ui` primitive
**Source**: [`design/`](../design/) boards; contrast analysis in [research R11](../research.md#r11-accessibility-and-contrast)

The token names and values below are the interface. Screens MUST reference tokens, never literal values (FR-004, SC-008). There is exactly one theme, and no mode exists (FR-033).

## Color (semantic)

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F6F6F3` | App and page background |
| `surface` | `#FFFFFF` | Cards, inputs, settings groups, review card, row hover |
| `text` | `#17181B` | Primary text |
| `textSecondary` | `#4A4C53` | Secondary copy, quiet buttons |
| `textMuted` | `#5E6068` | Captions, metadata, inactive nav, legends |
| `hairline` | `#E4E4DF` | Section rules, card borders, progress and mastery tracks |
| `divider` | `#EEEEEA` | Row separators inside settings groups |
| `controlBorder` | `#D9D9D3` | Outlined buttons, selectable cards (label-identified controls) |
| `controlBorderHover` | `#B9BAB4` | Hover border for selectable cards |
| `controlBorderStrong` | `#8C8D88` | Inputs, search, switch off-track outline, slider track, radio outline (3:1 boundary) |
| `fill` | `#ECECE8` | Nav hover and active, quiet hover, segmented track (Add) |
| `fillAlt` | `#F0F0EC` | Segmented track (Settings) |
| `fillSubtle` | `#FAFAF8` | Settings row hover |
| `primary` | `#17181B` | Primary action fill, active filter tab, selected card ring, switch on |
| `primaryHover` | `#2E3036` | Primary action hover and pressed |
| `onPrimary` | `#FFFFFF` | Text and icons on `primary` |
| `accent` | `#2846C4` | Links, progress fills, goal bar, focus ring |
| `accentHover` | `#1C3399` | Link hover and pressed |
| `danger` | `#B42318` | Log out, destructive text, Stuck (leech) badge |
| `success` | `#1E7A46` | Saved and synced states (derived, AA 5.35:1) |
| `warning` | `#8A5300` | Retrying badge, at-risk streak (derived, AA 6.33:1) |
| `focusRing` | `#2846C4` | 2 px focus outline on keyboard platforms |
| `scrim` | `rgba(23, 24, 27, 0.32)` | Overlay backdrop (full window, per `DESIGN.md`) |

## Stage ramp

Keys MUST match `learning_stage` values and `StatsSummary.stage_counts` keys. Unknown keys render as `new`.

| `stage.new` | `stage.learning` | `stage.recognized` | `stage.recalled` | `stage.usable` | `stage.mastered` |
|---|---|---|---|---|---|
| `#C4C6CC` | `#A9B6EA` | `#7C90DE` | `#5069CF` | `#2846C4` | `#172C85` |

Swatches are always shown next to their text label. They are decorative, so they are exempt from WCAG 1.4.11.

## Type roles

| Role | Family (web stack / native) | Weights | Notes |
|---|---|---|---|
| `ui` | `Geist, 'IBM Plex Sans KR', system-ui, sans-serif` / Geist, or Plex KR when the text contains Hangul | 400, 500, 600 | Default for all text |
| `display` | `Newsreader, Georgia, serif` / Newsreader | 400, 500 | Learnable words: lemmas, the Add input, the PN mark |
| `mono` | `'Geist Mono', ui-monospace, monospace` / Geist Mono | 400 | Pronunciation (IPA) and `Kbd` chips |

| Size token | px / line-height / weight / tracking | Use |
|---|---|---|
| `heroTitle` | 40 / 44 / 600 / −0.02em (phone 32 / 35) | Today headline |
| `pageTitle` | 32 / 37 / 600 / −0.02em | Words, Add, Settings titles |
| `sectionTitle` | 15 / 20 / 600 | "Up next", "Mastery", "Which meaning…" |
| `groupLabel` | 13 / 18 / 500, `textMuted` | Settings group headings |
| `body` | 15 / 22 / 400 | Default body |
| `bodySmall` | 14 / 20 / 400 | Nav items, links, secondary copy |
| `caption` | 13 / 18 / 400, `textMuted` | Metadata, legends |
| `micro` | 11–12 / 14 / 500 | Tab-bar labels, table header |
| `stat` | 22 / 26 / 600, tabular (phone 18) | Glance-strip values |
| `cardLemma` | 56 / 59 / 400 display (phone 44 / 46) | Review card word |
| `listLemma` | 20–22 / 26 / 400 display | Up next and Words rows |
| `inputDisplay` | 22 / 28 / 400 display | Add word input |
| `meaning` | 28 / 34 / 500 (phone 24 / 30) | Review card answer gloss |
| `ipa` | 12–14 / 18 / 400 mono | Pronunciation |
| `kbd` | 11 / 11 / 400 mono | Key hints |

All statistics, counters and progress numbers MUST use `fontVariant: ['tabular-nums']` (FR-006).

## Shape, size, layout

| Token | Value |
|---|---|
| `radii.kbd` | 5 |
| `radii.sm` | 8 (nav items, tabs, icon buttons; segments use 7) |
| `radii.md` | 10 (inputs, buttons, segmented track, example well) |
| `radii.lg` | 12 (hero buttons, selectable cards, rating choices) |
| `radii.xl` | 14 (settings groups) |
| `radii.card` | 16 (review card) |
| `controlHeight.tab` | 32 (hit area ≥ 44 via `hitSlop`) |
| `controlHeight.nav` | 36 (hit area ≥ 44 via `hitSlop`) |
| `controlHeight.button` | 40 / 44 |
| `controlHeight.hero` | 48 / 52 |
| `layout.sidebarWidth` | 232 (flex-basis) |
| `layout.sidebarMinPageWidth` | 720 |
| `layout.contentMaxWidth` | 760 |
| `layout.pagePadding` | wide `{ top: 56, x: 32, bottom: 80 }`; phone `{ top: safe-area + 24, x: 20 }` |
| `layout.tabBarItemMinHeight` | 52 |
| Elevation | None, except the selected segment: `0 1px 2px rgba(23,24,27,.08)` plus a 1 px `hairline` ring |

## Legacy alias map (transitional; removed in Polish)

These keep un-migrated `useTheme().colors.*` call sites rendering correctly in light mode. A Polish task deletes this block after a search shows zero uses.

| Legacy name | → Token |
|---|---|
| `primary` (legacy brand) | `accent` |
| `onPrimary` | `onPrimary` |
| `primaryContainer`, `secondaryContainer`, `surfaceContainer*`, `surfaceVariant`, `surfaceRaised`, `surfaceAlt`, `surfaceGlass` | `fill` (Highest/High) or `canvas` (Low/Lowest), per the mapping table in `tokens.ts` |
| `onPrimaryContainer`, `onSecondaryContainer`, `onSurface`, `onBackground`, `text` | `text` |
| `onSurfaceVariant`, `textMuted`, `secondary` | `textMuted` |
| `background` | `canvas` |
| `surface` | `surface` |
| `outlineVariant`, `border`, `borderGlass` | `hairline` |
| `outline`, `borderStrong` | `controlBorderStrong` |
| `error`, `danger` | `danger` |
| `errorContainer`, `dangerSurface` | `#FBEAE8` (danger tint) |
| `success` / `warning` / `info` and their `*Surface` / `*Border` | `success` / `warning` / `accent` with tints |
| `tertiary*`, `accent2`, `inverse*` | `accent` / `text` / `surface` as mapped in `tokens.ts` |

## Verification

- `tokens.test.ts` asserts every pair in research R11 meets its threshold. It fails if a token change regresses contrast.
- A static-guard test asserts that no `frontend/src` file outside `theme/` contains raw hex or `rgba(` literals (allowlist: `Confetti.tsx`) once the alias map is removed.
