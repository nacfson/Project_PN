import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, Icon, Text } from '../../ui';

interface GuestBannerProps {
  onSignIn: () => void;
}

export function GuestBanner({ onSignIn }: GuestBannerProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderBottomColor: colors.hairline },
      ]}
    >
      <View style={styles.textContainer}>
        <Icon name="information-circle-outline" size="sm" color={colors.accent} />
        <Text variant="caption" color={colors.textSecondary} style={styles.text}>
          Browsing as visitor — Sign in to sync your vocabulary and reviews with Google.
        </Text>
      </View>
      <Button label={t('auth.signIn')} variant="secondary" size="sm" onPress={onSignIn} />
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
