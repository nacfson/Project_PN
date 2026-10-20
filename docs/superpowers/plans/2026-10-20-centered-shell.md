# Centered Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the browser site a centered 420px page whose bar matches the page, and keep the phone on its own screen so the two cannot resize each other.

**Architecture:** `shellKind` picks `browser` or `phone` from platform and user agent, never from window width. Each kind has its own frame file. `MainTabs` renders the chosen frame around the existing tab navigator, so the absolute tab bar is positioned against the frame, not the window. A shared `TabSlot` holds the label inside the button. Only the browser frame scales when the window is under 420px.

**Tech Stack:** Expo / React Native, TypeScript, Jest, `@testing-library/react-native`

**Spec:** `docs/superpowers/specs/2026-10-20-centered-shell-design.md`

## Global Constraints

- Browser page width is 420. Phone frame width is not 420.
- `shellKind` must not take a viewport width. Narrow desktop web stays `browser`.
- Phone UA test: `/iPhone|iPod|Android/.test(ua) && /Mobile/.test(ua)` plus native `ios` and `android`. iPad web and Tauri stay `browser`.
- `browserScale(viewportWidth)` returns `1` when `viewportWidth < 1` or `viewportWidth >= 420`, otherwise `viewportWidth / 420`.
- Tab label uses `numberOfLines={1}` and `ellipsizeMode="tail"`. No sibling pill at 75% of the slot.
- Do not edit `AddScreen.tsx`, `ManualAddSection.tsx`, or `CaptureSection.tsx`.
- Do not remove theme chips, forecast, or progress from Learn.
- Do not remove `TabBarScrollContext` or the practice-screen bar hide.
- Frame modules do not import each other.

## Review Focus

- A desktop window at 300px must stay the browser page and scale, not flip to phone. Pinned in Task 1.
- A phone frame must not read the 420 width. Pinned in Task 2.
- A label longer than the slot must ellipsize inside the button, not paint over the next tab. Pinned in Task 3.
- The floating dock must not use `position: 'fixed'` against the window. Pinned in Task 4.
- Practice chrome must still be able to hide the bar. There is no existing test for that hide. Task 3 keeps `tabBarTranslateY` on the bar `View` and keeps `TabBarScrollContext.Provider` as an ancestor of the screens.

---

### Task 1: Shell kind and scale

**Files:**
- Create: `frontend/src/navigation/shellKind.ts`
- Test: `frontend/src/navigation/shellKind.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `shellKind(platform: string, userAgent: string): 'browser' | 'phone'` and `browserScale(viewportWidth: number): number`

- [ ] **Step 1: Write the failing test**

```ts
import { browserScale, shellKind } from './shellKind';

it('keeps a narrow desktop window on the browser page', () => {
  expect(shellKind('web', 'Mozilla/5.0 Macintosh')).toBe('browser');
  expect(shellKind('web', '')).toBe('browser');
});

it('sends native and phone browsers to the phone screen', () => {
  expect(shellKind('ios', '')).toBe('phone');
  expect(shellKind('android', '')).toBe('phone');
  expect(shellKind('web', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile')).toBe('phone');
});

it('does not treat iPad web or a missing width as phone', () => {
  expect(shellKind('web', 'Mozilla/5.0 (iPad) AppleWebKit')).toBe('browser');
  expect(browserScale(0)).toBe(1);
  expect(browserScale(300)).toBeCloseTo(300 / 420);
  expect(browserScale(900)).toBe(1);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -w frontend -- --testPathPattern=shellKind --watchman=false`
Expected: FAIL, `shellKind` is not defined.

- [ ] **Step 3: Implement `shellKind` and `browserScale` in `frontend/src/navigation/shellKind.ts`**

`shellKind` uses the Global Constraints regex. It has no width parameter. `browserScale` uses the formula in Global Constraints.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -w frontend -- --testPathPattern=shellKind --watchman=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/navigation/shellKind.ts frontend/src/navigation/shellKind.test.ts
git commit -m "feat: split browser and phone shell selection"
```

### Task 2: Separate frames

**Files:**
- Create: `frontend/src/navigation/browserFrame.tsx`
- Create: `frontend/src/navigation/phoneFrame.tsx`
- Test: `frontend/src/navigation/frames.test.tsx`

**Interfaces:**
- Consumes: `browserScale(viewportWidth: number): number` from Task 1
- Produces: `BrowserFrame` and `PhoneFrame`, each `({ children }: { children: React.ReactNode }) => JSX.Element`. `BROWSER_PAGE_WIDTH = 420` is exported only from `browserFrame.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BrowserFrame, BROWSER_PAGE_WIDTH } from './browserFrame';
import { PhoneFrame } from './phoneFrame';

it('centers a 420 page inside a full-width shell', () => {
  expect(BROWSER_PAGE_WIDTH).toBe(420);
  const browser = render(<BrowserFrame><Text>Learn</Text></BrowserFrame>);
  expect(browser.getByTestId('browser-shell').props.style).toEqual(
    expect.objectContaining({ width: '100%', alignItems: 'center' }),
  );
  expect(browser.getByTestId('browser-frame').props.style).toEqual(
    expect.objectContaining({ width: 420 }),
  );
  const phone = render(<PhoneFrame><Text>Learn</Text></PhoneFrame>);
  expect(phone.getByTestId('phone-frame').props.style.width).not.toBe(420);
});
```

Mock `useWindowDimensions` to `{ width: 1200, height: 800 }` in this file. Add a second test with width `300` that expects the inner frame's `transform` to be `[{ scale: 300 / 420 }]`. The outer shell stays full width, so the leftover padding stays equal.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -w frontend -- --testPathPattern=frames.test --watchman=false`
Expected: FAIL, cannot resolve `./browserFrame`.

- [ ] **Step 3: Implement the two frames**

`BrowserFrame` reads window width and calls `browserScale`. It renders an outer `View` (`testID="browser-shell"`, `width: '100%'`, `flex: 1`, `alignItems: 'center'`) and an inner page (`testID="browser-frame"`, `width: 420`, `position: 'relative'`, `flex: 1`, scale transform). The outer shell is what makes the side padding equal. `PhoneFrame` renders `testID="phone-frame"`, `flex: 1`, `width: '100%'`, and does not import `browserFrame.tsx` or `shellKind.ts`. Neither file imports the other.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -w frontend -- --testPathPattern=frames.test --watchman=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/navigation/browserFrame.tsx frontend/src/navigation/phoneFrame.tsx frontend/src/navigation/frames.test.tsx
git commit -m "feat: add separate browser and phone frames"
```

### Task 3: Contained tab label, wired into the shell

**Files:**
- Create: `frontend/src/navigation/TabSlot.tsx`
- Test: `frontend/src/navigation/TabSlot.test.tsx`
- Modify: `frontend/src/navigation/MainTabs.tsx`

**Interfaces:**
- Consumes: `BrowserFrame`, `PhoneFrame`, `shellKind(platform, userAgent)`
- Produces: `TabSlot` props `{ label: string; focused: boolean; onPress: () => void; onLongPress: () => void; testID: string; icon: React.ReactNode }`

- [ ] **Step 1: Write the failing test**

```tsx
it('keeps a long label inside the button', () => {
  render(
    <TabSlot
      label="SettingsSettingsSettings"
      focused
      onPress={() => {}}
      onLongPress={() => {}}
      testID="tab-settings"
      icon={null}
    />,
  );
  const label = screen.getByText('SettingsSettingsSettings');
  expect(label.props.numberOfLines).toBe(1);
  expect(label.props.ellipsizeMode).toBe('tail');
  expect(screen.getByTestId('tab-settings').props.style).toEqual(
    expect.objectContaining({ overflow: 'hidden', maxWidth: '100%' }),
  );
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -w frontend -- --testPathPattern=TabSlot --watchman=false`
Expected: FAIL, `TabSlot` is not defined.

- [ ] **Step 3: Implement `TabSlot` and use it from `CustomTabBar`**

Delete the sliding pill (`pillContainer`, `pill`, `pillLeft`). The focused slot's own background is the highlight. Keep the existing `tabBarTranslateY` animated style on the bar `View`. `MainTabs` reads `Platform.OS` and, on web only, `navigator.userAgent` (otherwise `''`), calls `shellKind`, and wraps the navigator in `BrowserFrame` or `PhoneFrame`. `TabBarScrollContext.Provider` stays an ancestor of the screens. Do not edit Learn card layout.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -w frontend -- --testPathPattern="TabSlot|AddScreen" --watchman=false`
Expected: PASS. Add tests still assert Manual-first. There is no bar-hide test to run; the pin is the animated style left on the bar.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/navigation/TabSlot.tsx frontend/src/navigation/TabSlot.test.tsx frontend/src/navigation/MainTabs.tsx
git commit -m "fix: keep tab labels inside their buttons"
```

### Task 4: Dock stays on the page

**Files:**
- Modify: `frontend/src/features/web/CommandDock.tsx`
- Test: `frontend/src/features/web/CommandDock.test.tsx`

**Interfaces:**
- Consumes: `BrowserFrame` position `relative` from Task 2. `MainTabs` already renders `CommandDock` inside the navigator tree; move that render inside `BrowserFrame` only.
- Produces: dock style `position: 'absolute'`, `right: 12`, `bottom: 72`. No `position: 'fixed'`.

- [ ] **Step 1: Extend the CommandDock test**

Assert the dock root style is `position: 'absolute'` and is not `'fixed'`. Keep the existing hide-at-width-390 test.

- [ ] **Step 2: Run the test and confirm the new assertion fails**

Run: `npm test -w frontend -- --testPathPattern=CommandDock --watchman=false`
Expected: FAIL on `position` being `'fixed'`.

- [ ] **Step 3: Change the dock position and mount it only in `BrowserFrame`**

`PhoneFrame` must not render `CommandDock`. The 390px hide stays.

- [ ] **Step 4: Run the focused frontend tests**

Run: `npm test -w frontend -- --testPathPattern="shellKind|frames.test|TabSlot|CommandDock|AddScreen|Screen.test" --watchman=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/web/CommandDock.tsx frontend/src/features/web/CommandDock.test.tsx frontend/src/navigation/MainTabs.tsx
git commit -m "fix: keep the web dock inside the browser page"
```
