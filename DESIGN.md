# Design Rules

Rules that keep the Project PN interface consistent. Recurring UX behavior (validation, loading, practice) lives in `frontend/docs/frontend-ux-patterns.md`.

## Overlays stay within the main UI's width

**Rule:** Bottom sheets, dialogs, and other overlay surfaces must never extend beyond the width of the main UI. Only a dimming backdrop may span the full window.

The main UI is the page rendered by `BrowserFrame` (`frontend/src/navigation/browserFrame.tsx`), capped at `BROWSER_PAGE_MAX_WIDTH` (`frontend/src/navigation/shellKind.ts`).

**Why this needs care:** on web, React Native's `Modal` renders through a portal on `document.body`, outside `BrowserFrame`. An overlay inside a `Modal` does not inherit the page's width cap, and a flex child stretches to fill the window by default.

**How to apply:** spread `PAGE_WIDTH_FRAME` into the overlay's surface style, not its backdrop:

```ts
sheet: {
  ...PAGE_WIDTH_FRAME,
  paddingHorizontal: 20,
},
```

**How it is enforced:** add each new bottom sheet to `frontend/src/components/bottomSheetWidth.test.tsx`, with `testID="bottom-sheet"` on its surface.

### Known exception

`InspectorPanel` (`frontend/src/features/web/InspectorPanel.tsx`) is anchored to the right edge of the window, so it sits outside the page when the window is wider than `BROWSER_PAGE_MAX_WIDTH`. It should be brought in line with this rule when that panel is next changed.
