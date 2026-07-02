# Design Spec: Premium Apple-Style UI/UX Upgrade

## 1. Overview & Objectives

This document specifies the visual rebranding and UX overhaul of the Project PN React Native/Expo frontend. The objective is to replace the current Material Design 3 (MD3) purple palette and flat layouts with a premium **Apple-style blue-indigo glassmorphism** theme, characterized by deep navy dark modes, crisp typography, and fluid scroll-driven animations.

### Success Criteria
- [ ] Swapping the current purple brand colors with a cohesive blue-indigo scale.
- [ ] Transitioning the default font system to **Inter** with proper weight mappings and negative letter-spacing for headings.
- [ ] Refactoring standard Card and Button primitives to support frosted glass, luminous borders, and primary-tinted shadows.
- [ ] Implementing scroll-driven animations: collapsible large titles and a scroll-hiding bottom navigation bar.
- [ ] Ensuring 100% parity across Dark and Light modes on iOS, Android, and Web/Tauri.

---

## 2. Design Tokens Overhaul (`src/theme/tokens.ts`)

We will rewrite the color tokens to transition from muted purple to the new premium scale.

### Color Palette Reference

| Token | Light Mode Value | Dark Mode Value | Notes |
|---|---|---|---|
| `primary` | `#4F6AFF` | `#7B93FF` | Blue-indigo primary brand color |
| `primaryContainer` | `#E8EDFF` | `#1E2A5E` | Semi-transparent selection backgrounds |
| `secondary` | `#5B6B8A` | `#A8B8D8` | Secondary labels and metadata |
| `tertiary` | `#E87C4F` | `#FFB088` | Warm accents (daily streaks) |
| `accent` | `#00B4A0` | `#4EDDC8` | Success states, XP progress bars |
| `background` | `#F5F7FC` | `#0A0E1A` | Main page background |
| `surface` | `#FFFFFF` | `#141827` | Solid card faces |
| `surfaceGlass` | `rgba(255, 255, 255, 0.72)` | `rgba(255, 255, 255, 0.05)` | Frosted glass background |
| `borderGlass` | `rgba(255, 255, 255, 0.5)` | `rgba(255, 255, 255, 0.08)` | Luminous card border |
| `outline` | `#C8CDD8` | `#2A3048` | Fallback flat borders / dividers |

### Typography Tokens (Inter)
- **Primary Font Family**: `Inter` (loaded via Expo Font weights: Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800).
- **Heading Styles**: Negative letter-spacing (`-0.3px` for title, `-0.5px` for headline) to match Apple's editorial look.
- **Sizes**:
  - `xs`: 11px
  - `sm`: 13px
  - `md`: 15px (default body)
  - `lg`: 17px
  - `xl`: 21px
  - `xxl`: 28px
  - `xxxl`: 34px

### Shadow Scale (Color-Tinted)
We will introduce primary-tinted shadows in light mode to provide rich depth:
- `sm`: `0 2px 8px rgba(79, 106, 255, 0.04)` (dark: `0 2px 8px rgba(0,0,0,0.2)`)
- `md`: `0 8px 16px rgba(79, 106, 255, 0.06)` (dark: `0 8px 16px rgba(0,0,0,0.3)`)
- `lg`: `0 16px 32px rgba(79, 106, 255, 0.1)` (dark: `0 16px 32px rgba(0,0,0,0.4)`)
- `glow`: `0 0 24px rgba(79, 106, 255, 0.15)`

---

## 3. Core Component Refactoring (`src/ui/`)

### `Card.tsx` & `CinematicCard.tsx`
- Add `glass` prop to toggle the glassmorphism state.
- Under Web, compile with `backdropFilter: 'blur(20px)'`.
- Under iOS, integrate `expo-blur` (`BlurView`) behind content when `glass` is active.
- Under Android, fall back to solid background with a slightly higher opacity (e.g. `0.92`) to maintain readability.
- Support a subtle hover gradient overlay tracking cursor coordinates (Web only).

### `Button.tsx`
- Refactor default `pressScale` to `0.95` (down from `0.97`) to create a snappier click feeling.
- Introduce `pill` prop (`borderRadius: radii.full`) alongside standard rounded-rectangle corners.
- Update variant color mapping to align with the new primary/secondary tokens.

### `Text.tsx`
- Clean up hardcoded style properties. Replace all font size styles with a reference to the `theme.typography.sizes` tokens.
- Apply `letterSpacing` values to the variants to ensure editorial styling.

### `AnimatedProgressBar.tsx`
- Introduce a continuous shimmer sweep overlay (a diagonally slanted linear gradient passing from left to right using a looping Reanimated translation).

---

## 4. Navigation & Layout Upgrades (`src/navigation/`)

### Sliding Pill Tab Indicator (`MainTabs.tsx`)
- Instead of simple icon highlighting, we will introduce an active pill background under the tab icons.
- When shifting between tabs, this active pill will slide horizontally using a wobbly spring physics transition.
- The indicator will squash/stretch slightly during the movement to simulate inertia:
  ```typescript
  // Squash/stretch simulation logic (Reanimated)
  const animWidth = useDerivedValue(() => {
    const dist = Math.abs(targetX.value - currentX.value);
    return baseWidth + dist * 0.15;
  });
  ```

### Collapsible Headers
- Implement a scroll observer inside the `Screen` wrapper.
- As the user scrolls downward, the large screen title container (`large-title`) will smoothly fade out and scale down (collapsing into the header).
- Simultaneously, a centered, compact title will fade in on the top sticky navigation bar.

### Scroll-Hiding Tab Bar
- Monitor scroll velocity and scroll direction.
- Scroll Down: Translate bottom navigation bar out of the screen (`translateY: 100px`, `opacity: 0`).
- Scroll Up: Instantly snap tab bar back into place (`translateY: 0`, `opacity: 1`) using a spring curve.

---

## 5. Screen Refreshes

1. **`HomeScreen.tsx` (Learn)**:
   - Convert stats grid into wobbly floating cards.
   - Refactor XP Progress card and Mastery chart to use gradient colors.
2. **`MyWordsScreen.tsx` (Words)**:
   - Apply clean search fields and horizontal filter chips.
   - Restyle word rows to feature soft glass details and SRS badges.
3. **`AddScreen.tsx` (Add)**:
   - Clean up manual and passage selector using `SegmentedControl` tokens.
4. **`PracticeScreen.tsx` (Practice)**:
   - Style the 3D flip card with depth perspective and borders.
   - Restyle grading buttons to use pill shapes and soft colors.
5. **`ProfileScreen.tsx` (Settings)**:
   - Convert account listings into grouped lists.
   - Wrap settings with custom sliders and a clean dark theme switcher.
