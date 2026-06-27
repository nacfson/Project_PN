import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Text } from '../ui';
import type { Deck } from '../types';

interface DeckSelectorProps {
  decks: Deck[];
  selectedId: string | null;
  onSelect: () => void;
  loading: boolean;
}

export function DeckSelector({ decks, selectedId, onSelect, loading }: DeckSelectorProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();

  const selected = decks.find((d) => d.id === selectedId);

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={t('add.selectDeck')}
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: radii.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.left}>
        <Text variant="caption" color="muted">
          {t('add.targetDeck')}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.xs }} />
        ) : (
          <Text variant="body" bold style={{ marginTop: spacing.xs }}>
            {selected?.name ?? t('add.noDeck')}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size="md" color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
});
