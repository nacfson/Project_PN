import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { enrollCurriculumPack, listCurriculumPacks } from '../../api/curriculum';
import type { CurriculumPack } from '../../types';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, Text } from '../../ui';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Learn'>;

export function CurriculumSection() {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NavigationProp>();
  const [packs, setPacks] = useState<CurriculumPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingSlug, setEnrollingSlug] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listCurriculumPacks()
      .then((loaded) => setPacks(loaded))
      .catch(() => setError(t('curriculum.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleEnroll = async (pack: CurriculumPack) => {
    setEnrollingSlug(pack.slug);
    setError(null);
    try {
      const result = await enrollCurriculumPack(pack.slug);
      setPacks((prev) =>
        prev.map((p) =>
          p.slug === pack.slug
            ? {
                ...p,
                enrolled: true,
                deck_id: result.deck_id,
                added_count: result.added_count,
                skipped_count: result.skipped_count,
              }
            : p
        )
      );
    } catch {
      setError(t('curriculum.enrollFailed'));
    } finally {
      setEnrollingSlug(null);
    }
  };

  const handleStudy = (pack: CurriculumPack) => {
    if (!pack.deck_id) return;
    navigation.navigate('Practice', { deckId: pack.deck_id });
  };

  return (
    <Card glass style={{ gap: spacing.md }} testID="curriculum-section">
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{t('curriculum.title')}</Text>
        <Text variant="body" color="muted">
          {t('curriculum.subtitle')}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <View style={{ gap: spacing.sm }}>
          <Text color="danger">{error}</Text>
          <Button label={t('common.retry')} variant="tonal" onPress={load} />
        </View>
      ) : packs.length === 0 ? (
        <Text color="muted">{t('curriculum.empty')}</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {packs.map((pack) => {
            const busy = enrollingSlug === pack.slug;
            return (
              <View
                key={pack.id}
                style={[
                  styles.packRow,
                  {
                    borderColor: colors.outlineVariant,
                    borderRadius: radii.md,
                    padding: spacing.md,
                    gap: spacing.sm,
                    backgroundColor: colors.surfaceContainerHighest,
                  },
                ]}
              >
                <View style={styles.packHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body" bold>
                      {pack.title}
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('curriculum.packMeta', {
                        band: pack.cefr_band,
                        count: pack.entry_count,
                      })}
                    </Text>
                  </View>
                  <Badge
                    label={pack.enrolled ? t('curriculum.enrolled') : pack.cefr_band}
                    variant={pack.enrolled ? 'success' : 'primary'}
                  />
                </View>
                <Text variant="caption" color="muted" numberOfLines={2}>
                  {pack.description}
                </Text>
                {pack.enrolled ? (
                  <View style={styles.actions}>
                    <Text variant="caption" color="muted" style={{ flex: 1 }}>
                      {t('curriculum.progress', {
                        added: pack.added_count,
                        total: pack.entry_count,
                      })}
                    </Text>
                    <Button
                      label={t('curriculum.study')}
                      variant="primary"
                      onPress={() => handleStudy(pack)}
                      disabled={!pack.deck_id}
                    />
                  </View>
                ) : (
                  <Button
                    label={busy ? t('curriculum.enrolling') : t('curriculum.enroll')}
                    variant="tonal"
                    onPress={() => void handleEnroll(pack)}
                    disabled={busy}
                    loading={busy}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  packRow: {
    borderWidth: 1,
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
