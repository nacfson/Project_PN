# Web Feature

## Overview
Provides web-only desktop chrome components: a floating bottom-right quick-action dock (`CommandDock`) and a right-hand slide-over inspector drawer (`InspectorPanel`).

## Interface
- `CommandDock({ navigation? })` `[CommandDock.tsx:CommandDock]` and `CommandDockProps` `[CommandDock.tsx:CommandDockProps]` — Floating web quick-action dock exposing Add Word (with pending queue count badge), Review, and Search actions that expand on hover.
- `InspectorPanel({ visible, onClose, children, title? })` `[InspectorPanel.tsx:InspectorPanel]` — Web-only right-side slide-over modal drawer with animated backdrop scrim, close button, and Escape-key dismissal.

## Invariants
- `CommandDock` renders `null` on non-web platforms (`Platform.OS !== 'web'`) or when viewport width `< 720` (`MOBILE_WEB_MAX_WIDTH`), and remains permanently expanded when `useReducedMotion()` is `true` `[CommandDock.tsx:CommandDock]`.
- `CommandDock` resolves navigation in order: `propNavigation` -> `useNavigation()` (guarded with `try/catch` for mounting outside a `NavigationContainer`) -> `navigationRef` (when `navigationRef.isReady()`) `[CommandDock.tsx:CommandDock]`.
- `InspectorPanel` renders `null` on non-web platforms (`Platform.OS !== 'web'`) and uses `0` ms animation durations when reduced motion is enabled `[InspectorPanel.tsx:InspectorPanel]`.

## Side Effects
- Triggers tab navigation to `Add` (`{ mode: 'manual', focusTick }`), `Practice` (`{ origin: 'private' }`), and `Words` `[CommandDock.tsx:CommandDock]`.
- Attaches and removes a `window` `keydown` listener on web to invoke `onClose` on `Escape`, and runs `Animated.parallel` slide/fade transitions `[InspectorPanel.tsx:InspectorPanel]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`
