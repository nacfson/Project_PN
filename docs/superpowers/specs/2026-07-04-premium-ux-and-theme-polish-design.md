# Specification: Premium UX Experiments & Theme Polish

This design specification details the plan to simplify the theme variations, resolve critical text-color and contrast rendering issues, and add high-end interactive micro-animations to the Project PN dashboard.

## 1. Simplified Premium Theme System & Text Contrast Fixes

### Problem
1. **Theme Bloat**: The codebase contains experimental themes (`cyberpunk`, `minimalist`, `brutalist`) that are unpolished and dilute the premium aesthetic.
2. **Text Contrast Bug**: The color merging function `getColorsForTheme` in `ThemeProvider.tsx` overrides surface and background colors, but does not propagate these changes to legacy color properties like `colors.text` and `colors.textMuted` which are eagerly resolved during base theme generation. This results in white-on-white text rendering issues when switching themes.

### Solution
- **Curated Variations**: Reduce theme variations to exactly 3 premium glassmorphic choices:
  - `bentoIndigo` (Indigo Glassmorphic - Default Dark)
  - `bentoSunset` (Sunset Glassmorphic - Warm Dark)
  - `bentoLight` (Light Glassmorphic - Default Light)
- **Automatic Base Mode Mapping**: Map each variation to its natural base mode (`light` or `dark`) so that semantic base colors align with light/dark contrast goals immediately.
- **Eager Property Propagation**: Re-evaluate legacy text and border color aliases (`text`, `textMuted`, `textInverse`, `border`) in `getColorsForTheme` after merging overrides to ensure overrides correctly cascade to components.

---

## 2. Bento Grid Card Micro-Interactions

### Plan
- Wrap dashboard Bento cards in a pressable container with custom micro-animations:
  - On press-in: Card scale animates from `1` to `0.98`, and `shadowOpacity` reduces slightly.
  - On press-out: Card scale bounces back to `1`.
  - Use React Native's `Animated` library for native-thread animations (`useNativeDriver: true`) to ensure butter-smooth performance.

---

## 3. Interactive Forecast Chart with Tooltips

### Plan
- Modify `ForecastChart` inside `HomeScreen.tsx`:
  - Make nodes on the spline chart interactive. Tapping a day node sets `activeNodeIndex`.
  - Display a floating, glassmorphic tooltip above the selected node containing:
    - Date / day offset (e.g. "Wed, Jul 8" or "Day 5").
    - Exact review count (e.g. "18 reviews due").
  - Animate the tooltip's appearance with a scale-up bounce animation (`Animated.spring`).
  - Provide a subtle press feedback gesture when nodes are selected.

---

## 4. XP Progress Orb Glow & Interactive Feedback

### Plan
- Enhance `XpProgressOrb` in `HomeScreen.tsx`:
  - Add a pulsing, rotating outer gradient glow representing active daily progress.
  - Make the orb interactive: tapping it triggers a clean scaling animation and displays a temporary overlay bubble showing:
    - Current daily XP stats (e.g. `"15 / 20 XP"`).
    - Remaining XP needed to maintain the streak (e.g. `"5 XP to daily goal!"`).

---

## Verification Plan

### Automated Tests
- Write a unit test block in `tokens.test.ts` verifying that only the 3 simplified variations are exported.
- Write test assertions in `HomeScreen.test.tsx` verifying that interactive Forecast Chart node selection renders a tooltip element.

### Manual Verification
- Deploy to the local Expo web server and verify:
  - Seamless theme variation switching without text readability bugs.
  - Interactive Forecast tooltips showing on node presses.
  - Press interactions on bento cards and the XP progress orb.
