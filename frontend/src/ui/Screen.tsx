import React, { createContext, useContext } from 'react';
import { StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
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
import { Text } from './Text';

export interface ScreenProps extends ScrollViewProps {
  padded?: boolean;
  title?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  as?: React.ComponentType<any>;
}

// Context to share scroll state with parent navigator for hiding the tab bar
export const TabBarScrollContext = createContext<{
  tabBarTranslateY: SharedValue<number>;
} | null>(null);

export const Screen = React.forwardRef<any, ScreenProps>(
  ({ padded, style, contentContainerStyle, children, title, onScroll, as, ...rest }, ref) => {
    const { colors, spacing } = useTheme();
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
          runOnJS(onScroll)(event);
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

    // Default scrollEnabled to true if title is present (to support collapsible headers),
    // otherwise default to false if not specified (to avoid conflicts with nested ScrollViews).
    const scrollEnabled = rest.scrollEnabled ?? (title ? true : false);

    const ScrollComponent = as || Animated.ScrollView;

    // Dynamically build scroll props as any to satisfy compiler for ScrollView/FlatList differences
    const scrollProps: any = {
      ref,
      onScroll: scrollHandler,
      scrollEventThrottle: 16,
      scrollEnabled,
      style: [styles.inner, style],
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
            <Text variant="headline" style={{ color: colors.onBackground }}>
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
        style={[styles.safe, { backgroundColor: colors.background }]}
      >
        {title && (
          <Animated.View
            style={[
              styles.smallHeader,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.outlineVariant,
              },
              smallHeaderAnimatedStyle,
            ]}
          >
            <Text variant="title" style={{ color: colors.onBackground }}>
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
              <Text variant="headline" style={{ color: colors.onBackground }}>
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
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  innerWithTitle: {
    paddingTop: 66,
  },
  smallHeader: {
    height: 56,
    width: '100%',
    maxWidth: 720,
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
});
