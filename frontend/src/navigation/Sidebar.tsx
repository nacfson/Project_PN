import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { useAppLanguage } from '../i18n';
import { useActiveTargetLanguage } from '../hooks/useActiveTargetLanguage';
import { Text } from '../ui';

export function Sidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, radii, controlHeight, layout, shadows } = useTheme();
  const { t, languageLabel } = useAppLanguage();
  const { targetLanguage, displayLanguage } = useActiveTargetLanguage();

  const targetName = displayLanguage || languageLabel(targetLanguage || 'en');
  const nativeName = languageLabel('ko');
  const pairLabel = t('nav.languagePair', { target: targetName, native: nativeName });

  return (
    <View
      testID="shell-sidebar"
      accessibilityLabel="Main"
      style={[
        styles.sidebar,
        {
          width: layout.sidebarWidth,
          flexBasis: layout.sidebarWidth,
          backgroundColor: colors.canvas,
          borderRightColor: colors.hairline,
        },
      ]}
    >
      <Pressable
        onPress={() => navigation.navigate('Learn')}
        hitSlop={8}
        accessibilityRole="button"
        style={styles.brand}
      >
        <View
          style={[
            styles.brandBadge,
            {
              backgroundColor: colors.brandPrimary,
              borderColor: colors.primaryHover,
              borderRadius: radii.sm,
            },
            shadows.segment,
          ]}
        >
          <Text
            role="display"
            style={{
              fontSize: 18,
              lineHeight: 20,
              fontWeight: '700',
              color: colors.onPrimary,
            }}
          >
            PN
          </Text>
        </View>
        <View style={styles.brandTextCol}>
          <Text
            role="display"
            style={{
              fontSize: 20,
              lineHeight: 24,
              fontWeight: '700',
              color: colors.text,
            }}
          >
            Project PN
          </Text>
          <Text variant="micro" color="muted">
            Word Adventure
          </Text>
        </View>
      </Pressable>

      <View style={styles.navList}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const isFocused = state.index === index;
          const testID = options.tabBarButtonTestID || `tab-button-${route.name.toLowerCase()}`;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              testID={testID}
              onPress={onPress}
              onLongPress={onLongPress}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              style={(pressState) => {
                const hovered = Boolean((pressState as { hovered?: boolean }).hovered);
                return [
                  styles.navItem,
                  {
                    height: controlHeight.nav,
                    borderRadius: radii.md,
                    borderWidth: 2,
                    borderColor: isFocused
                      ? colors.warningBright
                      : hovered
                        ? colors.hairline
                        : 'transparent',
                    backgroundColor: isFocused
                      ? colors.surfaceHighlight
                      : hovered || pressState.pressed
                        ? colors.fill
                        : 'transparent',
                    transform: [{ translateY: pressState.pressed ? 2 : 0 }],
                  },
                  isFocused ? shadows.segment : null,
                ];
              }}
            >
              {options.tabBarIcon
                ? options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? colors.brandPrimary : colors.textSecondary,
                    size: 22,
                  })
                : null}
              <Text
                role="display"
                variant="body"
                numberOfLines={1}
                style={{
                  color: isFocused ? colors.text : colors.textSecondary,
                  fontWeight: isFocused ? '700' : '600',
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.hairline,
            borderRadius: radii.md,
          },
          shadows.segment,
        ]}
      >
        <View style={[styles.pairDot, { backgroundColor: colors.brandSecondary }]} />
        <Text variant="caption" color="secondary" style={{ fontWeight: '700' }}>
          {pairLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    justifyContent: 'flex-start',
    gap: 28,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextCol: {
    gap: 2,
  },
  navList: {
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
  },
  pairDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
});
