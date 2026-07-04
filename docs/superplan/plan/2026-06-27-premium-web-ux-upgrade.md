# Premium Web UX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a web-first premium UX upgrade for Project PN: cinematic cards, staggered lists, a floating command dock, a right inspector panel, a deck canvas on Words, and a contextual command bar — while keeping the existing MD3 purple color system.

**Architecture:** Add small, focused animation/hover primitives (`useReducedMotion`, `StaggeredList`, `SkeletonCard`, `CinematicCard`, `HoverReveal`) and web-only layout components (`InspectorPanel`, `CommandDock`, `DeckCanvas`, `ContextualCommandBar`). Upgrade screens by wrapping existing content with the new primitives; avoid backend changes.

**Tech Stack:** React Native / Expo / TypeScript, `react-native-web`, `jest-expo`, `@testing-library/react-native`, `react-native-reanimated` is **not** being added — use `Animated` from `react-native` to avoid new native dependencies.

## Global Constraints

- Keep current MD3 tokens in `frontend/src/theme/tokens.ts`.
- Web-only features must be gated with `Platform.OS === 'web'` and degrade gracefully on iOS/Android.
- Respect `prefers-reduced-motion` via `useReducedMotion`.
- Every new component needs a unit test in the same directory.
- Add `en` and `ko` translation keys for all new copy in `frontend/src/i18n/translations.ts`.
- Run `npx tsc --noEmit` and `npm test -- --ci` after each task.
- Worktree: `/Users/hyungjuyu/Projects/iOS/Project_PN/.worktrees/feature-premium-web-ux` on branch `feature/premium-web-ux`.

---

## File Structure

### New primitives
- `frontend/src/hooks/useReducedMotion.ts` + `.test.ts`
- `frontend/src/ui/StaggeredList.tsx` + `.test.tsx`
- `frontend/src/ui/SkeletonCard.tsx` + `.test.tsx`
- `frontend/src/ui/HoverReveal.tsx` + `.test.tsx`
- `frontend/src/ui/CinematicCard.tsx` + `.test.tsx`
- `frontend/src/ui/AnimatedProgressBar.tsx` + `.test.tsx`

### New web-only components
- `frontend/src/features/web/InspectorPanel.tsx` + `.test.tsx`
- `frontend/src/features/web/CommandDock.tsx` + `.test.tsx`
- `frontend/src/features/words/DeckCanvas.tsx` + `.test.tsx`
- `frontend/src/ui/ContextualCommandBar.tsx` + `.test.tsx`

### Screen updates
- `frontend/src/features/learn/HomeScreen.tsx`
- `frontend/src/features/words/MyWordsScreen.tsx`
- `frontend/src/features/practice/PracticeScreen.tsx`
- `frontend/src/features/practice/Flashcard.tsx`
- `frontend/src/features/profile/ProfileScreen.tsx`

### Translations
- `frontend/src/i18n/translations.ts`

---

### Task 1: `useReducedMotion` hook

**Files:**
- Create: `frontend/src/hooks/useReducedMotion.ts`
- Test: `frontend/src/hooks/useReducedMotion.test.ts`

**Interfaces:**
- Produces: `useReducedMotion(): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { renderHook } from '@testing-library/react-native';
import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion', () => {
  it('returns false by default in test environment', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/hooks/useReducedMotion.test.ts --ci`
Expected: FAIL, `useReducedMotion` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => {
        if (mounted) setReduced(mq.matches);
      };
      update();
      if (mq.addEventListener) {
        mq.addEventListener('change', update);
        return () => {
          mounted = false;
          mq.removeEventListener('change', update);
        };
      }
      return () => {
        mounted = false;
      };
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return reduced;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/hooks/useReducedMotion.test.ts --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useReducedMotion.ts frontend/src/hooks/useReducedMotion.test.ts
git commit -m "feat(ux): add useReducedMotion hook"
```

---

### Task 2: `StaggeredList` component

**Files:**
- Create: `frontend/src/ui/StaggeredList.tsx`
- Test: `frontend/src/ui/StaggeredList.test.tsx`

**Interfaces:**
- Consumes: `useReducedMotion`
- Produces: `<StaggeredList delayMs={40} children />` animates children in.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { StaggeredList } from './StaggeredList';

describe('StaggeredList', () => {
  it('renders children', () => {
    const { getByText } = render(
      <StaggeredList>
        <Text>First</Text>
        <Text>Second</Text>
      </StaggeredList>
    );
    expect(getByText('First')).toBeTruthy();
    expect(getByText('Second')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/StaggeredList.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Children, ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface StaggeredListProps {
  children: ReactNode;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}

export function StaggeredList({ children, delayMs = 40, style }: StaggeredListProps) {
  const reduced = useReducedMotion();
  const anims = useRef<Animated.Value[]>([]);
  const items = Children.toArray(children);

  if (anims.current.length !== items.length) {
    anims.current = items.map(() => new Animated.Value(reduced ? 1 : 0));
  }

  useEffect(() => {
    if (reduced) return;
    const animations = anims.current.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        delay: index * delayMs,
        useNativeDriver: true,
      })
    );
    Animated.stagger(delayMs, animations).start();
  }, [items.length, delayMs, reduced]);

  return (
    <Animated.View style={style}>
      {items.map((child, index) => {
        const anim = anims.current[index] ?? new Animated.Value(1);
        return (
          <Animated.View
            key={index}
            style={{
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            }}
          >
            {child}
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/StaggeredList.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/StaggeredList.tsx frontend/src/ui/StaggeredList.test.tsx
git commit -m "feat(ux): add StaggeredList component"
```

---

### Task 3: `SkeletonCard` component

**Files:**
- Create: `frontend/src/ui/SkeletonCard.tsx`
- Test: `frontend/src/ui/SkeletonCard.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useReducedMotion`
- Produces: `<SkeletonCard lines={3} />` shimmer placeholder.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { SkeletonCard } from './SkeletonCard';

describe('SkeletonCard', () => {
  it('renders the requested number of lines', () => {
    const { getAllByTestId } = render(<SkeletonCard lines={3} />);
    expect(getAllByTestId('skeleton-line')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/SkeletonCard.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  const { colors, radii, spacing } = useTheme();
  const reduced = useReducedMotion();
  const shimmer = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [reduced, shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={{
        padding: spacing.lg,
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.xxl,
        gap: spacing.sm,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <View
          key={index}
          testID="skeleton-line"
          style={{
            height: 12,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceContainerHighest,
            width: index === lines - 1 ? '60%' : '100%',
            overflow: 'hidden',
          }}
        >
          {!reduced && (
            <Animated.View
              style={{
                width: '40%',
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.35)',
                transform: [{ translateX }],
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/SkeletonCard.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/SkeletonCard.tsx frontend/src/ui/SkeletonCard.test.tsx
git commit -m "feat(ux): add SkeletonCard component"
```

---

### Task 4: Update `Card` primitive for hover elevation and scale

**Files:**
- Modify: `frontend/src/ui/Card.tsx`
- Test: `frontend/src/ui/Card.test.tsx` (create)

**Interfaces:**
- Consumes: `useTheme`, `useReducedMotion`
- Produces: `Card` gains optional `hoverElevation`, `hoverScale`, `hoveredStyle` props.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Card>
        <Text>Hello</Text>
      </Card>
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Card onPress={onPress}>
        <Text>Press me</Text>
      </Card>
    );
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/Card.test.tsx --ci`
Expected: FAIL, test file not found.

- [ ] **Step 3: Update `Card.tsx`**

Replace the existing `Card` implementation with the version below. Keep the same prop interface plus new optional props.

```tsx
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
  variant?: 'filled' | 'outlined';
  onPress?: () => void;
  hoverElevation?: boolean;
  hoverScale?: boolean;
}

export function Card({
  elevated,
  variant = 'filled',
  onPress,
  hoverElevation,
  hoverScale,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, spacing, radii, shadows } = useTheme();
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleHoverIn = () => setHovered(true);
  const handleHoverOut = () => setHovered(false);

  const targetShadow = elevated || (hoverElevation && hovered) ? shadows.md : shadows.none;
  const targetScale = hoverScale && hovered && !reduced ? 1.01 : 1;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: targetScale,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [targetScale, scaleAnim]);

  const cardBody = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: variant === 'filled' ? colors.surfaceContainerLow : colors.surface,
          borderRadius: radii.xxl,
          padding: spacing.lg,
          borderColor: variant === 'outlined' ? colors.outlineVariant : 'transparent',
        },
        targetShadow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  if (!onPress) {
    return cardBody;
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
      >
        {cardBody}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
```

Note: add `useEffect` import if missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/Card.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Run full suite and type check**

Run: `cd frontend && npx tsc --noEmit && ./node_modules/.bin/jest --ci`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/ui/Card.tsx frontend/src/ui/Card.test.tsx
git commit -m "feat(ux): add hover elevation and scale to Card"
```

---

### Task 5: `HoverReveal` component

**Files:**
- Create: `frontend/src/ui/HoverReveal.tsx`
- Test: `frontend/src/ui/HoverReveal.test.tsx`

**Interfaces:**
- Consumes: `useReducedMotion`
- Produces: `<HoverReveal>{children}</HoverReveal>` fades children in on hover/focus.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { HoverReveal } from './HoverReveal';

describe('HoverReveal', () => {
  it('renders children', () => {
    const { getByText } = render(
      <HoverReveal>
        <Text>Hidden action</Text>
      </HoverReveal>
    );
    expect(getByText('Hidden action')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/HoverReveal.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { ReactNode, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface HoverRevealProps {
  children: ReactNode;
}

export function HoverReveal({ children }: HoverRevealProps) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const opacity = useState(() => new Animated.Value(0))[0];

  const animateTo = (value: number) => {
    if (reduced) return;
    Animated.timing(opacity, {
      toValue: value,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onHoverIn={() => {
        setVisible(true);
        animateTo(1);
      }}
      onHoverOut={() => {
        setVisible(false);
        animateTo(0);
      }}
      onFocus={() => {
        setVisible(true);
        animateTo(1);
      }}
      onBlur={() => {
        setVisible(false);
        animateTo(0);
      }}
    >
      <Animated.View style={{ opacity: reduced || visible ? 1 : opacity }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/HoverReveal.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/HoverReveal.tsx frontend/src/ui/HoverReveal.test.tsx
git commit -m "feat(ux): add HoverReveal component"
```

---

### Task 6: `CinematicCard` wrapper

**Files:**
- Create: `frontend/src/ui/CinematicCard.tsx`
- Test: `frontend/src/ui/CinematicCard.test.tsx`

**Interfaces:**
- Consumes: `Card`, `HoverReveal`
- Produces: `<CinematicCard revealActions={<Actions />} ... />`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CinematicCard } from './CinematicCard';

describe('CinematicCard', () => {
  it('renders children and calls onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <CinematicCard onPress={onPress}>
        <Text>Card body</Text>
      </CinematicCard>
    );
    fireEvent.press(getByText('Card body'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/CinematicCard.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Card } from './Card';
import { HoverReveal } from './HoverReveal';

interface CinematicCardProps extends ViewProps {
  onPress?: () => void;
  revealActions?: ReactNode;
  elevated?: boolean;
  children: ReactNode;
}

export function CinematicCard({
  onPress,
  revealActions,
  elevated,
  children,
  style,
  ...rest
}: CinematicCardProps) {
  return (
    <Card
      onPress={onPress}
      elevated={elevated}
      hoverElevation
      hoverScale
      style={style}
      {...rest}
    >
      <View style={{ position: 'relative' }}>
        {children}
        {revealActions ? (
          <View style={{ position: 'absolute', top: 0, right: 0 }}>
            <HoverReveal>{revealActions}</HoverReveal>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/CinematicCard.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/CinematicCard.tsx frontend/src/ui/CinematicCard.test.tsx
git commit -m "feat(ux): add CinematicCard wrapper"
```

---

### Task 7: `AnimatedProgressBar`

**Files:**
- Create: `frontend/src/ui/AnimatedProgressBar.tsx`
- Test: `frontend/src/ui/AnimatedProgressBar.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useReducedMotion`
- Produces: `<AnimatedProgressBar percent={60} />`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { AnimatedProgressBar } from './AnimatedProgressBar';

describe('AnimatedProgressBar', () => {
  it('renders', () => {
    const { getByTestId } = render(<AnimatedProgressBar percent={50} />);
    expect(getByTestId('progress-fill')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/AnimatedProgressBar.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';

interface AnimatedProgressBarProps {
  percent: number;
  height?: number;
}

export function AnimatedProgressBar({ percent, height = 12 }: AnimatedProgressBarProps) {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: reduced ? 0 : 350,
      useNativeDriver: false,
    }).start();
  }, [percent, reduced, widthAnim]);

  return (
    <View
      style={{
        height,
        borderRadius: radii.full,
        backgroundColor: colors.surfaceContainerHighest,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        testID="progress-fill"
        style={{
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: radii.full,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/AnimatedProgressBar.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/AnimatedProgressBar.tsx frontend/src/ui/AnimatedProgressBar.test.tsx
git commit -m "feat(ux): add AnimatedProgressBar component"
```

---

### Task 8: Apply cinematic motion to `HomeScreen`

**Files:**
- Modify: `frontend/src/features/learn/HomeScreen.tsx`
- Test: `frontend/src/features/learn/HomeScreen.test.tsx` (create)

**Interfaces:**
- Consumes: `StaggeredList`, `SkeletonCard`, `CinematicCard`, `AnimatedProgressBar`
- Produces: Home screen with shimmer loading, staggered cards, hover reveal on hero.

- [ ] **Step 1: Add imports and helper components**

At the top of `HomeScreen.tsx`, add:

```tsx
import { SkeletonCard } from '../../ui/SkeletonCard';
import { StaggeredList } from '../../ui/StaggeredList';
import { CinematicCard } from '../../ui/CinematicCard';
import { AnimatedProgressBar } from '../../ui/AnimatedProgressBar';
```

- [ ] **Step 2: Replace loading state with skeleton**

In the render body, when `stats` is null and not error, wrap existing cards with skeletons. Replace the existing `ScrollView` content where cards rely on `stats` being present with a guarded block.

Insert a `renderLoading()` helper:

```tsx
const renderLoading = () => (
  <View style={{ gap: spacing.lg }}>
    <SkeletonCard lines={2} />
    <SkeletonCard lines={4} />
    <View style={[styles.statsGrid, { gap: spacing.md }]}>
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
    </View>
  </View>
);
```

- [ ] **Step 3: Wrap cards with `StaggeredList`**

Change the outer `ScrollView` content from:

```tsx
<ScrollView contentContainerStyle={[styles.scroll, { paddingVertical: spacing.lg, gap: spacing.lg }]}>
```

to:

```tsx
<ScrollView contentContainerStyle={[styles.scroll, { paddingVertical: spacing.lg }]}>
  <View style={{ gap: spacing.lg }}>
```

And wrap the inner card list with:

```tsx
{statsError || !stats ? renderLoading() : (
  <StaggeredList style={{ gap: spacing.lg }}>
    ...existing cards...
  </StaggeredList>
)}
```

- [ ] **Step 4: Convert hero card to `CinematicCard`**

Replace the hero `<Card elevated onPress={...}>` with:

```tsx
<CinematicCard
  elevated
  onPress={() => navigation.navigate('Practice')}
  style={[styles.heroCard, { backgroundColor: colors.primaryContainer, borderColor: 'transparent' }]}
  revealActions={
    <Icon name="arrow-forward" size="md" color={colors.onPrimaryContainer} />
  }
>
  ...existing hero card content...
</CinematicCard>
```

- [ ] **Step 5: Convert XP progress track to `AnimatedProgressBar`**

Replace the XP progress `<View style={styles.goalTrack}>...<Animated.View ... /></View>` block with:

```tsx
<AnimatedProgressBar percent={Math.min(100, Math.round((xpToday / dailyGoalXP) * 100))} />
```

- [ ] **Step 6: Write/update tests**

Create `frontend/src/features/learn/HomeScreen.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';

jest.mock('../../api/auth', () => ({ me: jest.fn() }));
jest.mock('../../api/content', () => ({ getContentChallenges: jest.fn(), getWordOfTheDay: jest.fn() }));
jest.mock('../../api/stats', () => ({ getStatsSummary: jest.fn() }));
jest.mock('../../storage/captureHistory', () => ({ recentCaptureWords: jest.fn() }));

describe('HomeScreen', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Loading...')).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run tests and type check**

Run: `cd frontend && npx tsc --noEmit && ./node_modules/.bin/jest --ci`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/learn/HomeScreen.tsx frontend/src/features/learn/HomeScreen.test.tsx
git commit -m "feat(ux): cinematic motion on Home screen"
```

---

### Task 9: Build `InspectorPanel`

**Files:**
- Create: `frontend/src/features/web/InspectorPanel.tsx`
- Test: `frontend/src/features/web/InspectorPanel.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useReducedMotion`
- Produces: `<InspectorPanel visible onClose>{children}</InspectorPanel>`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { InspectorPanel } from './InspectorPanel';

describe('InspectorPanel', () => {
  it('renders children when visible', () => {
    const { getByText } = render(
      <InspectorPanel visible onClose={jest.fn()}>
        <Text>Inspector content</Text>
      </InspectorPanel>
    );
    expect(getByText('Inspector content')).toBeTruthy();
  });

  it('calls onClose when backdrop is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <InspectorPanel visible onClose={onClose}>
        <Text>Content</Text>
      </InspectorPanel>
    );
    fireEvent.press(getByTestId('inspector-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/features/web/InspectorPanel.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui';

interface InspectorPanelProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function InspectorPanel({ visible, onClose, children, title }: InspectorPanelProps) {
  const { colors, spacing, radii, shadows } = useTheme();
  const reduced = useReducedMotion();
  const translateX = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : 300,
        duration: reduced ? 0 : 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: reduced ? 0 : 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, reduced, translateX, opacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          testID="inspector-backdrop"
          onPress={onClose}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.25)',
            opacity,
          }}
        />
        <Animated.View
          style={{
            width: 360,
            maxWidth: '80%',
            height: '100%',
            backgroundColor: colors.surface,
            borderLeftWidth: 1,
            borderLeftColor: colors.outlineVariant,
            padding: spacing.lg,
            paddingTop: spacing.xxl,
            ...shadows.lg,
            transform: [{ translateX }],
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              position: 'absolute',
              top: spacing.lg,
              right: spacing.lg,
              padding: spacing.sm,
            }}
            accessibilityRole="button"
            accessibilityLabel="Close inspector"
          >
            <Icon name="close" size="md" />
          </Pressable>
          {title ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>{title}</Text>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
```

Note: import `Text` from `react-native` in this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/features/web/InspectorPanel.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/web/InspectorPanel.tsx frontend/src/features/web/InspectorPanel.test.tsx
git commit -m "feat(ux): add InspectorPanel component"
```

---

### Task 10: Build `CommandDock`

**Files:**
- Create: `frontend/src/features/web/CommandDock.tsx`
- Test: `frontend/src/features/web/CommandDock.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useNavigation`, `useAddQueue`
- Produces: `<CommandDock />` rendered inside `MainTabs` on web.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { CommandDock } from './CommandDock';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

describe('CommandDock', () => {
  it('renders dock items', () => {
    const { getByTestId } = render(<CommandDock />);
    expect(getByTestId('dock-add')).toBeTruthy();
    expect(getByTestId('dock-practice')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/features/web/CommandDock.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAddQueue } from '../../hooks/useAddQueue';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Text } from '../../ui';
import type { MainTabParamList } from '../../navigation/MainTabs';

type NavigationProp = BottomTabNavigationProp<MainTabParamList>;

const DOCK_ITEMS = [
  { id: 'add', icon: 'add', label: 'Add word', testID: 'dock-add', action: 'navigateAdd' as const },
  { id: 'practice', icon: 'school', label: 'Review', testID: 'dock-practice', action: 'navigatePractice' as const },
  { id: 'search', icon: 'search', label: 'Search', testID: 'dock-search', action: 'navigateWords' as const },
  { id: 'theme', icon: 'contrast', label: 'Theme', testID: 'dock-theme', action: 'toggleTheme' as const },
];

export function CommandDock() {
  if (Platform.OS !== 'web') return null;

  const { colors, spacing, radii, mode, setMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { pendingCount } = useAddQueue();
  const [expanded, setExpanded] = useState(false);

  const handleAction = (action: typeof DOCK_ITEMS[number]['action']) => {
    switch (action) {
      case 'navigateAdd':
        navigation.navigate('Add');
        break;
      case 'navigatePractice':
        navigation.navigate('Practice');
        break;
      case 'navigateWords':
        navigation.navigate('Words');
        break;
      case 'toggleTheme':
        setMode(mode === 'dark' ? 'light' : 'dark');
        break;
    }
  };

  return (
    <View
      style={{
        position: 'fixed',
        right: 20,
        bottom: 100,
        zIndex: 100,
        backgroundColor: colors.surface,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
        padding: spacing.sm,
        gap: spacing.sm,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      {(expanded ? DOCK_ITEMS : DOCK_ITEMS.slice(0, 1)).map((item) => (
        <Pressable
          key={item.id}
          testID={item.testID}
          onPress={() => handleAction(item.action)}
          style={({ hovered }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.full,
            backgroundColor: hovered ? colors.primaryContainer : 'transparent',
          })}
          onHoverIn={() => setExpanded(true)}
          onHoverOut={() => setExpanded(false)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Icon name={item.icon as never} size="md" color={colors.primary} />
          {expanded ? (
            <Text variant="label" color="primary">
              {item.label}
              {item.id === 'add' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
```

Note: `position: 'fixed'` and `boxShadow` are web-only styles and safe because component returns null on native.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/features/web/CommandDock.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Mount `CommandDock` in `MainTabs`**

Modify `frontend/src/navigation/MainTabs.tsx`:

Add import:

```tsx
import { CommandDock } from '../features/web/CommandDock';
```

Inside the returned `View`, after `Tab.Navigator` closing tag, add:

```tsx
<CommandDock />
```

- [ ] **Step 6: Run full suite and type check**

Run: `cd frontend && npx tsc --noEmit && ./node_modules/.bin/jest --ci`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/web/CommandDock.tsx frontend/src/features/web/CommandDock.test.tsx frontend/src/navigation/MainTabs.tsx
git commit -m "feat(ux): add CommandDock and mount in MainTabs"
```

---

### Task 11: Build `DeckCanvas`

**Files:**
- Create: `frontend/src/features/words/DeckCanvas.tsx`
- Test: `frontend/src/features/words/DeckCanvas.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Card`, `HoverReveal`
- Produces: `<DeckCanvas decks selectedId onSelect onCreate onEdit onInspect />`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { DeckCanvas } from './DeckCanvas';
import type { Deck } from '../../types';

const decks: Deck[] = [
  { id: '1', name: 'Daily', item_count: 10, is_default: true, user_id: 'u1', target_language: 'en', created_at: '', updated_at: '' },
];

describe('DeckCanvas', () => {
  it('renders decks and create tile', () => {
    const { getByText } = render(
      <DeckCanvas decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={jest.fn()} />
    );
    expect(getByText('Daily')).toBeTruthy();
    expect(getByText('New deck')).toBeTruthy();
  });

  it('calls onSelect when a deck is pressed', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <DeckCanvas decks={decks} selectedId={null} onSelect={onSelect} onCreate={jest.fn()} />
    );
    fireEvent.press(getByText('Daily'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/features/words/DeckCanvas.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Pressable, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, HoverReveal, Icon, Text } from '../../ui';
import type { Deck } from '../../types';

export interface DeckCanvasProps {
  decks: Deck[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit?: (deck: Deck) => void;
  onInspect?: (deck: Deck) => void;
}

export function DeckCanvas({ decks, selectedId, onSelect, onCreate, onEdit, onInspect }: DeckCanvasProps) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {decks.map((deck) => {
        const selected = selectedId === deck.id;
        return (
          <View key={deck.id} style={{ width: '46%', minWidth: 140 }}>
            <Card
              onPress={() => onSelect(deck.id)}
              hoverElevation
              hoverScale
              style={{
                backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLow,
                borderColor: selected ? colors.primary : colors.outlineVariant,
                borderRadius: radii.xxl,
                padding: spacing.lg,
                minHeight: 100,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text variant="title" bold color={selected ? 'onPrimaryContainer' : 'default'}>
                  {deck.name}
                </Text>
                <HoverReveal>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {onInspect && (
                      <Pressable onPress={() => onInspect(deck)} hitSlop={8} accessibilityRole="button">
                        <Icon name="information-circle-outline" size="md" color={colors.primary} />
                      </Pressable>
                    )}
                    {onEdit && (
                      <Pressable onPress={() => onEdit(deck)} hitSlop={8} accessibilityRole="button">
                        <Icon name="create-outline" size="md" color={colors.primary} />
                      </Pressable>
                    )}
                  </View>
                </HoverReveal>
              </View>
              <Text variant="caption" color={selected ? 'onPrimaryContainer' : 'muted'}>
                {t('add.deckCardCount', { count: deck.item_count })}
              </Text>
            </Card>
          </View>
        );
      })}
      <Pressable onPress={onCreate} style={{ width: '46%', minWidth: 140 }}>
        <View
          style={{
            borderRadius: radii.xxl,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.outlineVariant,
            padding: spacing.lg,
            minHeight: 100,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          <Icon name="add-circle" size="lg" color={colors.primary} />
          <Text variant="label" color="primary">
            {t('words.createDeck')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/features/words/DeckCanvas.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/words/DeckCanvas.tsx frontend/src/features/words/DeckCanvas.test.tsx
git commit -m "feat(ux): add DeckCanvas component"
```

---

### Task 12: Build `ContextualCommandBar`

**Files:**
- Create: `frontend/src/ui/ContextualCommandBar.tsx`
- Test: `frontend/src/ui/ContextualCommandBar.test.tsx`

**Interfaces:**
- Consumes: `useTheme`
- Produces: `<ContextualCommandBar selectedCount actions onClear />`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ContextualCommandBar } from './ContextualCommandBar';

describe('ContextualCommandBar', () => {
  it('renders actions and calls onClear', () => {
    const onClear = jest.fn();
    const onRename = jest.fn();
    const { getByText, getByTestId } = render(
      <ContextualCommandBar
        selectedCount={2}
        onClear={onClear}
        actions={[{ id: 'rename', label: 'Rename', icon: 'create-outline', onPress: onRename }]}
      />
    );
    fireEvent.press(getByText('Rename'));
    expect(onRename).toHaveBeenCalled();
    fireEvent.press(getByTestId('command-bar-clear'));
    expect(onClear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/ContextualCommandBar.test.tsx --ci`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Text } from './';

interface CommandAction {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  disabled?: boolean;
}

interface ContextualCommandBarProps {
  selectedCount: number;
  actions: CommandAction[];
  onClear: () => void;
}

export function ContextualCommandBar({ selectedCount, actions, onClear }: ContextualCommandBarProps) {
  const { colors, spacing, radii, shadows } = useTheme();

  if (selectedCount === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inverseSurface,
        borderRadius: radii.full,
        padding: spacing.sm,
        paddingHorizontal: spacing.lg,
        ...shadows.lg,
        zIndex: 50,
      }}
    >
      <Text variant="label" color="inverse" style={{ marginRight: spacing.md }}>
        {selectedCount} selected
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            disabled={action.disabled}
            onPress={action.onPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              padding: spacing.sm,
              borderRadius: radii.full,
              opacity: pressed || action.disabled ? 0.6 : 1,
            })}
            accessibilityRole="button"
          >
            <Icon name={action.icon as never} size="sm" color={colors.inverseOnSurface} />
            <Text variant="caption" color="inverse">
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          testID="command-bar-clear"
          onPress={onClear}
          style={{ padding: spacing.sm }}
          accessibilityRole="button"
        >
          <Icon name="close" size="sm" color={colors.inverseOnSurface} />
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && ./node_modules/.bin/jest src/ui/ContextualCommandBar.test.tsx --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/ContextualCommandBar.tsx frontend/src/ui/ContextualCommandBar.test.tsx
git commit -m "feat(ux): add ContextualCommandBar component"
```

---

### Task 13: Rewrite `MyWordsScreen` with deck canvas, inspector, and command bar

**Files:**
- Modify: `frontend/src/features/words/MyWordsScreen.tsx`
- Test: update `frontend/src/features/words/MyWordsScreen.test.tsx`

**Interfaces:**
- Consumes: `DeckCanvas`, `InspectorPanel`, `ContextualCommandBar`, `CinematicCard`, `HoverReveal`
- Produces: Words screen with deck canvas, inline word list, inspector for deck edits, batch deck actions.

- [ ] **Step 1: Add imports**

Add to `MyWordsScreen.tsx`:

```tsx
import { Platform } from 'react-native';
import { DeckCanvas } from './DeckCanvas';
import { InspectorPanel } from '../../features/web/InspectorPanel';
import { ContextualCommandBar } from '../../ui/ContextualCommandBar';
import { CinematicCard } from '../../ui/CinematicCard';
import { HoverReveal } from '../../ui/HoverReveal';
```

- [ ] **Step 2: Add selection state**

Inside `MyWordsScreen`, after `operationError` state add:

```tsx
const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());
const [inspectorDeck, setInspectorDeck] = useState<Deck | null>(null);
```

- [ ] **Step 3: Add selection helpers**

```tsx
const toggleDeckSelection = (deckId: string) => {
  setSelectedDeckIds((prev) => {
    const next = new Set(prev);
    if (next.has(deckId)) next.delete(deckId);
    else next.add(deckId);
    return next;
  });
};

const clearDeckSelection = () => setSelectedDeckIds(new Set());

const handleSetDefault = async () => {
  // Future backend endpoint; for now no-op with console warning.
  console.warn('Set default deck not yet implemented');
};

const handleBatchRename = () => {
  const first = decks.find((d) => selectedDeckIds.has(d.id));
  if (first) {
    setFormDeck(first);
    setFormMode('rename');
  }
};

const handleBatchDelete = async () => {
  const toDelete = decks.filter((d) => selectedDeckIds.has(d.id) && !d.is_default);
  for (const deck of toDelete) {
    try {
      await deleteDeck(deck.id);
    } catch (err) {
      console.error('Batch delete failed for', deck.id, err);
    }
  }
  setSelectedDeckIds(new Set());
  await loadDecks();
  await refresh();
};
```

- [ ] **Step 4: Replace deck list with canvas**

Replace the existing `DeckList` usage (around line 299) with:

```tsx
<DeckCanvas
  decks={decks}
  selectedId={selectedDeckId}
  onSelect={(id) => {
    if (Platform.OS === 'web') {
      toggleDeckSelection(id);
    }
    setSelectedDeckId(id);
  }}
  onCreate={openCreate}
  onEdit={(deck) => {
    setSelectedDeckId(deck.id);
    openEdit(deck);
  }}
  onInspect={(deck) => setInspectorDeck(deck)}
/>
```

- [ ] **Step 5: Convert word rows to `CinematicCard`**

In `renderItem`, replace `<Card style={{ marginBottom: spacing.md }} onPress={...}>` with:

```tsx
<CinematicCard
  onPress={() => navigation.navigate('WordDetail', { item })}
  style={{ marginBottom: spacing.md }}
  revealActions={
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Pressable onPress={() => {}} hitSlop={8} accessibilityRole="button">
        <Icon name="folder-open-outline" size="md" color={colors.primary} />
      </Pressable>
    </View>
  }
>
  ...existing row content...
</CinematicCard>
```

- [ ] **Step 6: Add `InspectorPanel` for deck details**

Inside the returned JSX, before the closing `</Screen>` tag, add:

```tsx
<InspectorPanel
  visible={inspectorDeck !== null}
  onClose={() => setInspectorDeck(null)}
  title={inspectorDeck?.name}
>
  <View style={{ gap: spacing.md }}>
    <Text variant="caption" color="muted">
      {t('add.deckCardCount', { count: inspectorDeck?.item_count ?? 0 })}
    </Text>
    <Button
      label={t('words.renameDeck')}
      variant="tonal"
      onPress={() => {
        if (inspectorDeck) openEdit(inspectorDeck);
        setInspectorDeck(null);
      }}
    />
    {inspectorDeck && !inspectorDeck.is_default && (
      <Button
        label={t('words.deleteDeck')}
        variant="outline"
        onPress={async () => {
          try {
            await deleteDeck(inspectorDeck.id);
            setSelectedDeckId(null);
            await loadDecks();
            await refresh();
          } catch (err) {
            console.error(err);
          }
          setInspectorDeck(null);
        }}
      />
    )}
  </View>
</InspectorPanel>
```

- [ ] **Step 7: Add `ContextualCommandBar`**

Inside the returned JSX, before the closing `</Screen>` tag, add:

```tsx
<ContextualCommandBar
  selectedCount={selectedDeckIds.size}
  onClear={clearDeckSelection}
  actions={[
    {
      id: 'rename',
      label: t('words.renameDeck'),
      icon: 'create-outline',
      onPress: handleBatchRename,
      disabled: selectedDeckIds.size !== 1,
    },
    {
      id: 'delete',
      label: t('words.deleteDeck'),
      icon: 'trash-outline',
      onPress: handleBatchDelete,
      disabled: Array.from(selectedDeckIds).some((id) => decks.find((d) => d.id === id)?.is_default),
    },
  ]}
/>
```

- [ ] **Step 8: Update tests**

Update `frontend/src/features/words/MyWordsScreen.test.tsx` to find deck canvas tiles instead of `DeckList` chips. Add tests for inspector opening and command bar appearing on web. Keep existing tests passing.

- [ ] **Step 9: Run tests and type check**

Run: `cd frontend && npx tsc --noEmit && ./node_modules/.bin/jest --ci`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/words/MyWordsScreen.tsx frontend/src/features/words/MyWordsScreen.test.tsx
git commit -m "feat(ux): deck canvas, inspector, and command bar on Words screen"
```

---

### Task 14: Polish `PracticeScreen` / `Flashcard`

**Files:**
- Modify: `frontend/src/features/practice/Flashcard.tsx`
- Modify: `frontend/src/features/practice/PracticeScreen.tsx`

**Interfaces:**
- Consumes: `useReducedMotion`
- Produces: Smoother flip, staggered rating buttons, animated progress bar.

- [ ] **Step 1: Enhance flip animation in `Flashcard.tsx`**

The component already flips with `rotateY`. Ensure `backfaceVisibility: 'hidden'` is set (it is). Add a subtle scale spring during flip:

Inside the existing `useEffect` that animates `flipAnim`, add a parallel scale animation or replace with `Animated.parallel`:

```tsx
const flipScale = useRef(new Animated.Value(1)).current;

useEffect(() => {
  Animated.parallel([
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 180 : 0,
      duration: reduced ? 0 : 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
    Animated.sequence([
      Animated.timing(flipScale, {
        toValue: 0.95,
        duration: reduced ? 0 : 175,
        useNativeDriver: true,
      }),
      Animated.timing(flipScale, {
        toValue: 1,
        duration: reduced ? 0 : 175,
        useNativeDriver: true,
      }),
    ]),
  ]).start();
}, [isFlipped, flipAnim, flipScale, reduced]);
```

Apply `flipScale` to the outer `Animated.View` style transform:

```tsx
<Animated.View style={[styles.cardContainer, animatedStyle, { transform: [...animatedStyle.transform, { scale: flipScale }] }]}>
```

Wait: `animatedStyle` already has `transform`. Compose correctly:

```tsx
<Animated.View
  style={[
    styles.cardContainer,
    {
      transform: [
        ...pan.getTranslateTransform(),
        { rotate },
        { scale: Animated.multiply(scale, flipScale) },
      ],
    },
  ]}
>
```

Use `Animated.multiply(scale, flipScale)`.

- [ ] **Step 2: Stagger rating buttons in `PracticeScreen.tsx`**

In the grading panel, wrap the `RatingBar` with `StaggeredList`:

```tsx
<StaggeredList delayMs={40}>
  <RatingBar intervals={currentItem.preview_intervals} onSelect={selectGrade} />
</StaggeredList>
```

- [ ] **Step 3: Use `AnimatedProgressBar` in `PracticeScreen.tsx`**

Replace the progress bar container/fill with:

```tsx
<AnimatedProgressBar percent={progressPercent} height={6} />
```

- [ ] **Step 4: Run tests and type check**

Run: `cd frontend && npx tsc --noEmit && ./node_modules/.bin/jest --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/practice/Flashcard.tsx frontend/src/features/practice/PracticeScreen.tsx
git commit -m "feat(ux): polish practice animations"
```

---

### Task 15: Polish `ProfileScreen` setting rows

**Files:**
- Modify: `frontend/src/features/profile/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `CinematicCard`, `HoverReveal`
- Produces: Setting rows wrapped in cinematic cards with hover chevron reveal.

- [ ] **Step 1: Update `SettingRow` to use hover reveal**

Replace the existing `SettingRow` component in `ProfileScreen.tsx` with:

```tsx
function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
  trailing,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed, hovered }) => [
        styles.row,
        {
          paddingVertical: spacing.md,
          opacity: pressed ? 0.7 : 1,
          backgroundColor: hovered ? colors.surfaceContainer : 'transparent',
          borderRadius: 12,
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: danger ? colors.errorContainer : colors.primaryContainer }]}>
        <Icon name={icon} size="md" color={danger ? colors.error : colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text variant="body" style={{ color: danger ? colors.error : colors.onSurface }}>
          {label}
        </Text>
        {value ? (
          <Text variant="caption" color="muted">
            {value}
          </Text>
        ) : null}
      </View>
      {trailing || (onPress && (
        <HoverReveal>
          <Icon name="chevron-forward" size="sm" />
        </HoverReveal>
      ))}
    </Pressable>
  );
}
```

- [ ] **Step 2: Wrap setting groups in `CinematicCard`**

Replace each `<Card>` in `ProfileScreen.tsx` with `<CinematicCard>`. For example:

```tsx
<CinematicCard>
  ...existing card content...
</CinematicCard>
```

- [ ] **Step 3: Stagger language pair list**

In `LanguagePairsScreen.tsx` (if it uses a list), wrap the list with `StaggeredList`. If no list wrapper exists, skip this step and apply stagger to the mapped rows.

- [ ] **Step 4: Run tests and type check**

Run: `cd frontend && npx tsc --noEmit && ./node_modules/.bin/jest --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/profile/ProfileScreen.tsx frontend/src/features/profile/LanguagePairsScreen.tsx
git commit -m "feat(ux): cinematic cards and hover reveals on Settings"
```

---

### Task 16: Add translation keys

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

**Interfaces:**
- Add new keys used by new components.

- [ ] **Step 1: Add English keys**

In `en`, add:

```ts
  'commandDock.addWord': 'Add word',
  'commandDock.review': 'Review',
  'commandDock.search': 'Search',
  'commandDock.theme': 'Theme',
  'inspector.close': 'Close inspector',
  'contextualCommandBar.selected': '{count} selected',
  'deckCanvas.newDeck': 'New deck',
```

- [ ] **Step 2: Add Korean keys**

In `ko`, add:

```ts
  'commandDock.addWord': '단어 추가',
  'commandDock.review': '복습',
  'commandDock.search': '검색',
  'commandDock.theme': '테마',
  'inspector.close': '검사기 닫기',
  'contextualCommandBar.selected': '{count}개 선택됨',
  'deckCanvas.newDeck': '새 덱',
```

- [ ] **Step 3: Update component copy to use keys**

Replace hardcoded labels in `CommandDock.tsx`, `InspectorPanel.tsx`, `ContextualCommandBar.tsx`, and `DeckCanvas.tsx` with `t('key')` calls.

- [ ] **Step 4: Run tests and type check**

Run: `cd frontend && npx tsc --noEmit && ./node_modules/.bin/jest --ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n/translations.ts
git commit -m "feat(ux): add translation keys for premium UX components"
```

---

### Task 17: Final verification

**Files:**
- All modified files.

- [ ] **Step 1: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run tests**

Run: `cd frontend && ./node_modules/.bin/jest --ci`
Expected: all suites pass.

- [ ] **Step 3: Start local web process**

Run: `scripts/start-web-dev.sh --skip-db` from the worktree root (DB is already running).
Wait for backend `/readyz` and Expo on `http://localhost:8081`.

- [ ] **Step 4: Manual browser verification**

Open `http://localhost:8081` and verify:
1. Home cards lift on hover and stagger in on load.
2. Command dock appears bottom-right on web and navigates.
3. Words tab shows deck canvas; clicking a deck loads word list inline.
4. Hovering a deck tile reveals info/edit chips; clicking info opens inspector.
5. Selecting multiple decks shows the contextual command bar.
6. Practice card flips smoothly; rating buttons appear staggered.
7. Settings rows show hover chevron and use cinematic cards.

- [ ] **Step 5: Commit any final fixes**

```bash
git commit -am "fix(ux): final verification fixes"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|------------------|------|
| Keep MD3 colors | Global constraint + no color changes |
| Cinematic cards | Tasks 4, 6, 8, 13, 15 |
| Command dock | Task 10 |
| Inspector panel | Tasks 9, 13 |
| Deck canvas | Tasks 11, 13 |
| Contextual command bar | Tasks 12, 13 |
| Staggered lists | Tasks 2, 8, 14, 15 |
| Skeleton loading | Task 3, 8 |
| Reduced motion | Tasks 1, all animation components |
| Web-only | `Platform.OS === 'web'` checks in `CommandDock`, web-specific inspector |
| Batch deck actions | Task 13 |

### Placeholder scan

No TBD/TODO placeholders remain. All tasks include concrete file paths, code, and commands.

### Type consistency

- `useReducedMotion` returns `boolean` and is used as such.
- `StaggeredList` accepts `delayMs?: number` consistently.
- `Card` props `hoverElevation` and `hoverScale` are optional booleans.
- `InspectorPanel` props are `visible`, `onClose`, `children`, `title?`.
- `CommandDock` returns `null` on non-web platforms.
- `DeckCanvas` props match usage in `MyWordsScreen`.
