# UI/UX Overhaul: Warm & Playful Motion System

## Goal

Transform Project PN from a functional vocabulary app into one that *feels alive* — playful spring-based animations, a warm hybrid color palette, and celebration moments that reward learning progress.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Aesthetic direction | Warm & friendly (Duolingo / Notion inspired) |
| Color palette | **Hybrid** — purple primary + coral/teal warm accents |
| Motion personality | **Playful & bouncy** — visible spring overshoots, things feel alive |
| Typography | **Nunito** — rounded, friendly, weights 400–800 |
| Animation scope | Comprehensive — screen transitions, component micro-animations, celebrations |
| Implementation approach | Foundation + HomeScreen as reference, other screens adopt incrementally |

---

## Proposed Changes

### Foundation: Theme Tokens

#### [MODIFY] [tokens.ts](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/theme/tokens.ts)

Update the MD3 color palettes to the hybrid variant. Both `md3Light` and `md3Dark` objects shift to warmer tones. Add `accent` and `accent2` tokens to `legacyColors`:

| Token | Current Dark | New Hybrid Dark |
|-------|-------------|-----------------|
| `primary` | `#d0bcff` | `#b794f4` |
| `primaryContainer` | `#4f378b` | `#363152` |
| `background` | `#141218` | `#171520` |
| `surface` | `#141218` | `#171520` |
| New: `accent` | — | `#ff8a80` (coral) |
| New: `accent2` | — | `#4ecdc4` (teal) |
| `success` | `#16a34a` | `#4ecdc4` |

Light mode equivalent shifts (warmer lavender backgrounds, soft coral/teal).

Set `typography.fontFamily = 'Nunito'`.

Increase default `radii` slightly to feel rounder:

| Token | Current | New |
|-------|---------|-----|
| `sm` | `6` | `8` |
| `md` | `10` | `12` |
| `lg` | `14` | `16` |
| `xl` | `18` | `20` |
| `xxl` | `28` | `28` (keep) |

---

#### [NEW] [motion.ts](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/theme/motion.ts)

Reusable motion presets module:

```typescript
// Spring presets (for react-native-reanimated withSpring)
export const spring = {
  bouncy:  { damping: 12, stiffness: 150, mass: 0.8 },  // Card press, button tap, celebrations
  snappy:  { damping: 20, stiffness: 300, mass: 0.6 },  // Chip toggles, tab switches, quick feedback
  gentle:  { damping: 15, stiffness: 100, mass: 1.0 },  // Page transitions, modals, large elements
} as const;

// Timing presets (for withTiming)
export const timing = {
  fast:    { duration: 200 },   // Opacity fades, color changes
  medium:  { duration: 350 },   // Progress bar fills, crossfades
  slow:    { duration: 600 },   // Staggered list entrances
} as const;

// Stagger delay between items in a list
export const stagger = {
  tight:   40,   // ms between children in StaggeredList
  normal:  60,   // ms between forecast bars
  relaxed: 80,   // ms between mastery bars
} as const;

// Scale values for press/hover feedback
export const scale = {
  pressed:  0.97,
  hovering: 1.02,
  bounce:   1.05,  // Momentary overshoot for chip select, celebrations
} as const;
```

Also exports `useReducedMotion()` hook wrapping `AccessibilityInfo.isReduceMotionEnabled()`.

---

#### [MODIFY] [ThemeProvider.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/theme/ThemeProvider.tsx)

No structural changes — just re-export `motion` presets from the theme context for convenience.

---

### Foundation: Typography

#### [MODIFY] [package.json](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/package.json)

Add `@expo-google-fonts/nunito` dependency for native font loading.

#### [MODIFY] [App.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/App.tsx)

Load Nunito font family via `useFonts` from `@expo-google-fonts/nunito` at app startup. Show splash screen until fonts are loaded.

---

### HomeScreen Polish

#### [MODIFY] [HomeScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/learn/HomeScreen.tsx)

**Entrance animations:**
- Greeting: fade-up with `spring.gentle`, 100ms delay
- Hero card: fade-up + scale (0.95→1) with `spring.bouncy`, 200ms delay
- Stat cards: staggered fade-up, `stagger.tight` (40ms) delay between each, `spring.bouncy`
- Mastery bars: staggered width animation, `stagger.relaxed` (80ms) per bar, `spring.gentle`
- Forecast bars: staggered height grow from 0, `stagger.normal` (60ms) per bar, `spring.bouncy`

All entrance animations triggered on mount/`useFocusEffect`, not on re-render.

**Interaction feedback:**
- Hero card: `spring.bouncy` scale press (1→0.97→1) + navigate to Practice tab
- Stat cards: `spring.bouncy` scale press + haptic
- Mastery rows: `translateX(4px)` on hover/press with `spring.snappy`
- Forecast bars: `brightness(1.15)` + `scaleY(1.05)` on hover with `spring.snappy`

**Visual enhancements:**
- Hero card: gradient `primary → accent` (purple→coral) background with decorative circle blob overlays
- Stat cards: `surface` bg with 1px `border` + `shadow.sm`, emoji icons (🔥 streak, 📖 words, ⚡ XP)
- XP bar fill: gradient `primary → accent2` (purple→teal) with shimmer overlay animation
- Section titles: uppercase, 11px, `text-muted`, letter-spacing 0.8px

**Error state fix:**
- On error → show `ErrorState` component with retry button (currently shows skeletons — bug)
- On loading → show `SkeletonCard` shimmer
- On success → crossfade from skeleton to content (300ms overlap via opacity transition)

**Pull-to-refresh:**
- Replace `ScrollView` with `ScrollView` + `RefreshControl` (themed tint color `primary`)

---

### Cross-Cutting: Screen Transitions

#### [MODIFY] [RootNavigator.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/navigation/RootNavigator.tsx)

Custom screen transition config:
- Stack pushes: horizontal slide + 30% fade overlay on outgoing screen, `spring.gentle`

#### [MODIFY] [MainTabs.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/navigation/MainTabs.tsx)

- Tab switches: add `tabBarAnimation` config for crossfade between tab content

---

### Cross-Cutting: Component Animations

#### [MODIFY] [QueueBanner.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/components/QueueBanner.tsx)

- **Entrance:** slide-up from bottom + fade in with `spring.bouncy`
- **Exit:** slide-down + fade out with `timing.fast`
- **Auto-dismiss:** success toasts auto-dismiss after 3 seconds

#### [MODIFY] [ContextualCommandBar.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/ui/ContextualCommandBar.tsx)

- **Entrance:** slide-up from bottom + scale (0.95→1) with `spring.snappy`
- **Exit:** reverse of entrance

#### [MODIFY] [TappablePassage.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/components/TappablePassage.tsx)

- Word tap: `spring.snappy` scale pulse (1→1.08→1) + background color fade (`timing.fast`)

#### [MODIFY] [Chip.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/ui/Chip.tsx)

- Selection: `timing.fast` background-color transition + `spring.snappy` scale pulse (1→1.05→1)

#### [MODIFY] [AnimatedProgressBar.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/ui/AnimatedProgressBar.tsx)

- Switch from `withTiming(350ms)` to `spring.bouncy` for playful overshoot fill
- Add gradient support (accept `gradientColors` prop)
- Add shimmer overlay animation

---

### Cross-Cutting: Celebration Moments

#### [NEW] [Confetti.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/ui/Confetti.tsx)

Lightweight confetti/particle-burst component:
- 8-12 small circles in accent colors (coral, teal, purple, amber)
- Scatter outward with random angles + gravity curve
- Fade out over 800ms
- Triggered imperatively via `confettiRef.current.burst()`
- Respects `useReducedMotion()`

#### [NEW] [CountUpText.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/ui/CountUpText.tsx)

Animated number counter:
- Counts from 0 to target value over 600ms
- Optional scale bounce at completion
- Used for XP earned, words reviewed, streak count

#### [MODIFY] [PracticeScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/practice/PracticeScreen.tsx)

- Session success screen: XP counter uses `CountUpText` + `Confetti.burst()` on mount
- Show additional stats: cards reviewed, accuracy %, time spent

#### [MODIFY] [HomeScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/learn/HomeScreen.tsx)

- When XP bar reaches 100%: glow pulse on the bar + "🎉 Goal reached!" toast via `QueueBanner`
- Streak milestone (7, 30, 100): hero card gradient flash + 🔥 bounce

#### [MODIFY] [CaptureSection.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/add/CaptureSection.tsx) / [ManualAddSection.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/add/ManualAddSection.tsx)

- Word added: QueueBanner success toast gets ✅ icon + mini particle burst on the toast itself

---

### Cross-Cutting: Loading States

#### [MODIFY] [StaggeredList.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/ui/StaggeredList.tsx)

- Accept `loading` prop
- When transitioning from loading→loaded: crossfade skeleton placeholders to real content

#### [MODIFY] [MyWordsScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/features/words/MyWordsScreen.tsx)

- Add `RefreshControl` for pull-to-refresh
- Use inline skeleton row at FlatList bottom during pagination loading

---

### Cross-Cutting: Barrel Export Cleanup

#### [MODIFY] [index.ts](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/ui/index.ts)

Add missing exports:
```typescript
export { SkeletonCard } from './SkeletonCard';
export { CinematicCard } from './CinematicCard';
export { ContextualCommandBar } from './ContextualCommandBar';
export { Confetti } from './Confetti';        // new
export { CountUpText } from './CountUpText';  // new
```

---

## File Change Summary

| Category | File | Action |
|----------|------|--------|
| **Foundation** | `src/theme/tokens.ts` | MODIFY (palette, radii, fontFamily) |
| | `src/theme/motion.ts` | **NEW** (spring/timing/stagger presets) |
| | `src/theme/ThemeProvider.tsx` | MODIFY (re-export motion) |
| | `package.json` | MODIFY (add @expo-google-fonts/nunito) |
| | `App.tsx` | MODIFY (load Nunito) |
| **HomeScreen** | `src/features/learn/HomeScreen.tsx` | MODIFY (animations, visuals, error fix, pull-to-refresh) |
| **Transitions** | `src/navigation/RootNavigator.tsx` | MODIFY (custom stack transition) |
| | `src/navigation/MainTabs.tsx` | MODIFY (tab crossfade) |
| **Components** | `src/components/QueueBanner.tsx` | MODIFY (entrance/exit animation, auto-dismiss) |
| | `src/components/TappablePassage.tsx` | MODIFY (tap scale pulse) |
| | `src/ui/ContextualCommandBar.tsx` | MODIFY (entrance/exit animation) |
| | `src/ui/Chip.tsx` | MODIFY (selection transition) |
| | `src/ui/AnimatedProgressBar.tsx` | MODIFY (spring fill, gradient, shimmer) |
| | `src/ui/StaggeredList.tsx` | MODIFY (loading crossfade) |
| | `src/ui/index.ts` | MODIFY (barrel exports) |
| **New UI** | `src/ui/Confetti.tsx` | **NEW** |
| | `src/ui/CountUpText.tsx` | **NEW** |
| **Screens** | `src/features/practice/PracticeScreen.tsx` | MODIFY (session summary, celebrations) |
| | `src/features/words/MyWordsScreen.tsx` | MODIFY (pull-to-refresh, pagination skeleton) |
| | `src/features/add/CaptureSection.tsx` | MODIFY (success celebration) |
| | `src/features/add/ManualAddSection.tsx` | MODIFY (success celebration) |

**Total: 3 new files, 18 modified files**

---

## Verification Plan

### Automated Tests
```bash
cd frontend && npx jest --passWithNoTests
```
- Update existing `AnimatedProgressBar.test.tsx`, `StaggeredList.test.tsx`, `Card.test.tsx` for new props
- Add tests for `Confetti`, `CountUpText` (render without crash, respects reduced motion)

### Manual Verification
- Toggle dark/light mode — verify both palettes look correct
- HomeScreen: verify staggered entrance animations play on focus
- HomeScreen: verify pull-to-refresh works
- HomeScreen: verify error state shows ErrorState (not skeletons)
- Practice: complete a session → verify CountUpText + Confetti on success screen
- Add word → verify QueueBanner toast slides in/out with animation
- MyWordsScreen: tap filter chips → verify scale pulse + color transition
- Web/Tauri: verify hover effects on cards, forecast bars
- Test with iOS "Reduce Motion" on → verify all animations respect the setting
- Verify Nunito font loads and renders on iOS, Web, and Tauri
