import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export interface SettingsGroupProps {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SettingsGroup({ title, children, style }: SettingsGroupProps) {
  const { colors, radii, spacing, shadows } = useTheme();
  const childArray = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={[styles.groupWrap, style]}>
      {title ? (
        <Text
          variant="sectionTitle"
          role="display"
          style={{ paddingHorizontal: 4, marginBottom: spacing.sm, color: colors.text }}
        >
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.groupCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.hairline,
            borderRadius: radii.card,
          },
          shadows.playful,
        ]}
      >
        {childArray.map((child, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 ? (
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            ) : null}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export interface SettingsRowProps {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  testID?: string;
  disabled?: boolean;
}

export function SettingsRow({
  title,
  subtitle,
  trailing,
  onPress,
  tone = 'default',
  testID,
  disabled,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const isDanger = tone === 'danger';

  const content = (
    <>
      <View style={styles.rowText}>
        <Text
          variant="body"
          style={{
            color: isDanger ? colors.danger : colors.text,
            fontWeight: '500',
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowTrailing}>
        {trailing}
        {onPress && !trailing ? (
          <Icon
            name="chevron-forward"
            size="sm"
            color={isDanger ? colors.danger : colors.textMuted}
          />
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={(state) => {
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        return [
          styles.row,
          {
            backgroundColor: state.pressed || hovered ? colors.fillSubtle : 'transparent',
            opacity: disabled ? 0.5 : 1,
          },
        ];
      }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groupWrap: {
    width: '100%',
  },
  groupCard: {
    borderWidth: 2,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 56,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
