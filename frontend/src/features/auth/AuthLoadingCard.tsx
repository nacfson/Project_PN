import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAppLanguage } from '../../i18n';
import { radii, spacing, useTheme } from '../../theme';
import { Card, Text } from '../../ui';

const SLOW_WAIT_THRESHOLD_MS = 3500;

export interface AuthLoadingCardProps {
  title: string;
  onCancel?: () => void;
  slowThresholdMs?: number;
}

export function AuthLoadingCard({
  title,
  onCancel,
  slowThresholdMs = SLOW_WAIT_THRESHOLD_MS,
}: AuthLoadingCardProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const reducedMotion = useReducedMotion();

  const [isSlow, setIsSlow] = useState(false);

  const outerSpin = useRef(new Animated.Value(0)).current;
  const innerSpin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setIsSlow(false);
    const timer = setTimeout(() => {
      setIsSlow(true);
    }, slowThresholdMs);
    return () => {
      clearTimeout(timer);
    };
  }, [slowThresholdMs, title]);

  useEffect(() => {
    if (reducedMotion) {
      outerSpin.setValue(0);
      innerSpin.setValue(0);
      pulse.setValue(0);
      return;
    }

    const outerLoop = Animated.loop(
      Animated.timing(outerSpin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const innerLoop = Animated.loop(
      Animated.timing(innerSpin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    outerLoop.start();
    innerLoop.start();
    pulseLoop.start();

    return () => {
      outerLoop.stop();
      innerLoop.stop();
      pulseLoop.stop();
    };
  }, [innerSpin, outerSpin, pulse, reducedMotion]);

  const outerRotate = outerSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerRotate = innerSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0.45],
  });

  const subtitle = isSlow ? t('auth.loadingSlowSubtitle') : t('auth.loadingKeepOpen');

  return (
    <Card
      elevated
      testID="auth-loading-card"
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={title}
      style={styles.card}
    >
      <View style={styles.emblemWrapper} testID="auth-brand-pulse">
        <Animated.View
          style={[
            styles.pulseHalo,
            {
              backgroundColor: colors.dangerSurface,
              borderRadius: radii.full,
              opacity: reducedMotion ? 0.85 : pulseOpacity,
              transform: [{ scale: reducedMotion ? 1 : pulseScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.outerRing,
            {
              borderRadius: radii.full,
              borderColor: colors.fill,
              borderTopColor: colors.brandPrimary,
              borderRightColor: colors.brandPrimary,
              transform: [{ rotate: outerRotate }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.innerRing,
            {
              borderRadius: radii.full,
              borderColor: 'transparent',
              borderTopColor: colors.accent,
              transform: [{ rotate: innerRotate }],
            },
          ]}
        />
        <Text style={[styles.monogram, { color: colors.text }]}>PN</Text>
      </View>

      <Text variant="sectionTitle" role="ui" style={styles.title}>
        {title}
      </Text>
      <Text color={colors.textMuted} style={styles.subtitle}>
        {subtitle}
      </Text>

      {isSlow && onCancel ? (
        <Pressable
          testID="auth-loading-cancel"
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelPill,
            {
              backgroundColor: pressed ? colors.fillAlt : colors.fill,
              borderColor: colors.controlBorder,
              borderRadius: radii.full,
            },
          ]}
        >
          <Text variant="caption" color={colors.textSecondary} style={styles.cancelText}>
            {t('auth.loadingCancelRetry')}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.dotsRow, { marginTop: spacing.md }]}>
          <View
            style={[
              styles.dot,
              { backgroundColor: colors.brandPrimary, borderRadius: radii.full },
            ]}
          />
          <View
            style={[
              styles.dot,
              { backgroundColor: colors.accent, borderRadius: radii.full },
            ]}
          />
          <View
            style={[
              styles.dot,
              { backgroundColor: colors.brandTertiary, borderRadius: radii.full },
            ]}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 400,
    minHeight: 236,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emblemWrapper: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pulseHalo: {
    position: 'absolute',
    width: 68,
    height: 68,
  },
  outerRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderWidth: 4.5,
  },
  innerRing: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderWidth: 3.5,
  },
  monogram: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
  dotsRow: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
  },
  cancelPill: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
