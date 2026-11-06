import React, { createContext, useContext } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { shellKind, shellLayout } from '../navigation/shellKind';
import { Text } from './Text';

export interface ScreenProps
  extends ScrollViewProps,
    Partial<Omit<FlatListProps<any>, keyof ScrollViewProps | 'ListHeaderComponent'>> {
  padded?: boolean;
  title?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  as?: React.ComponentType<any>;
  ListHeaderComponent?: React.ReactNode | React.ComponentType<any>;
}

export interface ShellChromeContextValue {
  tabBarTranslateY: SharedValue<number>;
  tabBarInteractive: boolean;
  setTabBarInteractive: (interactive: boolean) => void;
  chromeHidden?: boolean;
  setChromeHidden?: (hidden: boolean) => void;
}

// Context to share scroll state and chrome visibility with parent navigator
export const TabBarScrollContext = createContext<ShellChromeContextValue | null>(null);
export const ShellChromeContext = TabBarScrollContext;

export function useShellChrome() {
  const ctx = useContext(TabBarScrollContext);
  return {
    chromeHidden: ctx?.chromeHidden ?? false,
    setChromeHidden: ctx?.setChromeHidden ?? (() => {}),
  };
}

export function PageColumn({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { layout } = useTheme();
  const { width } = useWindowDimensions();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const currentShell = shellKind(Platform.OS, ua);
  const currentLayout = shellLayout(currentShell, width);
  const isWide = currentLayout === 'sidebar';

  const pad = isWide ? layout.pagePadding.wide : layout.pagePadding.phone;

  return (
    <View
      style={[
        styles.pageColumn,
        {
          maxWidth: layout.contentMaxWidth,
          paddingTop: pad.top,
          paddingHorizontal: pad.x,
          paddingBottom: pad.bottom,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Screen = React.forwardRef<any, ScreenProps>(
  ({ padded, style, contentContainerStyle, children, title, onScroll, as, ...rest }, ref) => {
    const { colors, spacing, layout } = useTheme();
    const insets = useSafeAreaInsets();
    const scrollContext = useContext(TabBarScrollContext);
    const scrollY = useSharedValue(0);
    const lastScrollY = useSharedValue(0);
    const accumulatedDelta = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
      onScroll: (event: any) => {
        const currentY = event.contentOffset.y;
        const delta = currentY - lastScrollY.value;
        scrollY.value = currentY;

        if (scrollContext) {
          if (currentY <= 0) {
            scrollContext.tabBarTranslateY.value = withTiming(0, { duration: 200 });
            accumulatedDelta.value = 0;
          } else {
            const wasScrollingDown = accumulatedDelta.value > 0;
            const isScrollingDown = delta > 0;

            if (isScrollingDown === wasScrollingDown) {
              accumulatedDelta.value += delta;
            } else {
              accumulatedDelta.value = delta;
            }

            if (accumulatedDelta.value > 40 && currentY > 50) {
              scrollContext.tabBarTranslateY.value = withTiming(100, { duration: 200 });
            } else if (accumulatedDelta.value < -40) {
              scrollContext.tabBarTranslateY.value = withTiming(0, { duration: 200 });
            }
          }
        }
        lastScrollY.value = currentY;

        if (onScroll) {
          runOnJS(onScroll)({ nativeEvent: event } as unknown as NativeSyntheticEvent<NativeScrollEvent>);
        }
      },
    });

    const smallHeaderAnimatedStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        scrollY.value,
        [30, 70],
        [0, 1],
        Extrapolation.CLAMP
      );
      const translateY = interpolate(
        scrollY.value,
        [10, 50],
        [-10, 0],
        Extrapolation.CLAMP
      );
      return {
        opacity,
        transform: [{ translateY }],
      };
    });

    const largeHeaderAnimatedStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        scrollY.value,
        [0, 40],
        [1, 0],
        Extrapolation.CLAMP
      );
      const scale = interpolate(
        scrollY.value,
        [-50, 0, 40],
        [1.05, 1, 0.95],
        Extrapolation.CLAMP
      );
      return {
        opacity,
        transform: [{ scale }],
      };
    });

    const scrollEnabled = rest.scrollEnabled ?? (title ? true : false);
    const ScrollComponent = as || Animated.ScrollView;

    const scrollProps: any = {
      ref,
      onScroll: scrollHandler,
      scrollEventThrottle: 16,
      scrollEnabled,
      style: [styles.inner, { maxWidth: layout.contentMaxWidth }, style],
      contentContainerStyle: [
        padded && { paddingHorizontal: spacing.xl },
        title ? styles.innerWithTitle : undefined,
        { paddingBottom: 60 + insets.bottom + 16 },
        contentContainerStyle,
      ],
      ...rest,
    };

    if (as && title) {
      const UserHeaderComponent = rest.ListHeaderComponent;
      scrollProps.ListHeaderComponent = (
        <View>
          <Animated.View
            style={[
              styles.largeHeader,
              padded && { paddingHorizontal: spacing.xl },
              largeHeaderAnimatedStyle,
            ]}
          >
            <Text variant="pageTitle" style={{ color: colors.text }}>
              {title}
            </Text>
          </Animated.View>
          {UserHeaderComponent && (
            typeof UserHeaderComponent === 'function'
              ? React.createElement(UserHeaderComponent as any)
              : UserHeaderComponent
          )}
        </View>
      );
    }

    return (
      <SafeAreaView
        edges={['top', 'right', 'left']}
        style={[styles.safe, { backgroundColor: colors.canvas }]}
      >
        {title && (
          <Animated.View
            style={[
              styles.smallHeader,
              {
                maxWidth: layout.contentMaxWidth,
                backgroundColor: colors.canvas,
                borderBottomColor: colors.hairline,
              },
              smallHeaderAnimatedStyle,
            ]}
          >
            <Text variant="sectionTitle" style={{ color: colors.text }}>
              {title}
            </Text>
          </Animated.View>
        )}
        <ScrollComponent {...scrollProps}>
          {!as && title && (
            <Animated.View
              style={[
                styles.largeHeader,
                padded && { paddingHorizontal: spacing.xl },
                largeHeaderAnimatedStyle,
              ]}
            >
              <Text variant="pageTitle" style={{ color: colors.text }}>
                {title}
              </Text>
            </Animated.View>
          )}
          {!as && children}
        </ScrollComponent>
      </SafeAreaView>
    );
  }
);

Screen.displayName = 'Screen';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  inner: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'center',
  },
  innerWithTitle: {
    paddingTop: 66,
  },
  smallHeader: {
    height: 56,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  largeHeader: {
    paddingVertical: 20,
    justifyContent: 'center',
  },
  pageColumn: {
    width: '100%',
    alignSelf: 'center',
  },
});
