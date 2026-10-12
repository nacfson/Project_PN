import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, Text } from '../../ui';
import { useAppLanguage } from '../../i18n';

interface GuestBannerProps {
  onSignIn: () => void;
}

export function GuestBanner({ onSignIn }: GuestBannerProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainer, borderBottomColor: colors.outlineVariant }]}>
      <View style={styles.textContainer}>
        <Icon name="information-circle-outline" size="sm" color={colors.primary} />
        <Text variant="caption" color="muted" style={styles.text}>
          Browsing as visitor — Sign in to sync your vocabulary and reviews with Google.
        </Text>
      </View>
      <Button
        label={t('auth.signIn')}
        variant="tonal"
        onPress={onSignIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 12,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
