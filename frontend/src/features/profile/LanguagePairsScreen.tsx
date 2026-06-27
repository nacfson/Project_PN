import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getUserLanguages,
  removeUserLanguage,
  setActiveUserLanguage,
} from '../../api/userLanguages';
import { me } from '../../api/auth';
import type { UserLanguage } from '../../types/auth';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage } from '../../i18n';
import { Button, Card, Icon, LoadingState, Screen, Text } from '../../ui';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';

export function LanguagePairsScreen() {
  const { colors, spacing } = useTheme();
  const { t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const [pairs, setPairs] = useState<UserLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTarget, setActiveTarget] = useState<string | undefined>();

  const fetchPairs = useCallback(async () => {
    try {
      const response = await getUserLanguages();
      setPairs(response);
      setActiveTarget(response.find((p) => p.is_active)?.target_language);
    } catch {
      setPairs([]);
    }
  }, []);

  useEffect(() => {
    void fetchPairs().finally(() => setLoading(false));
  }, [fetchPairs]);

  useFocusEffect(
    useCallback(() => {
      void fetchPairs();
    }, [fetchPairs]),
  );

  const handleSetActive = async (targetLanguage: string) => {
    if (targetLanguage === activeTarget) return;
    setRefreshing(true);
    try {
      await setActiveUserLanguage(targetLanguage);
      await me();
      await fetchPairs();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = (pair: UserLanguage) => {
    const target = languageLabel(pair.target_language);
    const display = languageLabel(pair.display_language);
    Alert.alert(
      t('settings.removeLanguagePairTitle', { target, display }),
      t('settings.removeLanguagePairMessage', { target, display }),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.removeLanguagePairConfirm'),
          style: 'destructive',
          onPress: async () => {
            setRefreshing(true);
            try {
              await removeUserLanguage(pair.target_language);
              await fetchPairs();
            } finally {
              setRefreshing(false);
            }
          },
        },
      ],
    );
  };

  const handleEdit = (pair: UserLanguage) => {
    navigation.navigate('EditLanguagePair', {
      targetLanguage: pair.target_language,
      displayLanguage: pair.display_language,
    });
  };

  if (loading) {
    return (
      <Screen padded>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">{t('settings.languagePairs')}</Text>
          <Text variant="caption" color="muted">
            {t('settings.languagePairsDescription')}
          </Text>
        </View>

        {refreshing && (
          <View style={{ alignItems: 'center' }}>
            <Text variant="caption" color="muted">{t('app.loading')}</Text>
          </View>
        )}

        <View style={{ gap: spacing.md }}>
          {pairs.length === 0 ? (
            <Card variant="outlined">
              <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
                {t('settings.noLanguagePairs')}
              </Text>
            </Card>
          ) : (
            pairs.map((pair) => (
              <Card key={pair.target_language} variant="filled">
                <View style={styles.row}>
                  <Pressable
                    onPress={() => handleSetActive(pair.target_language)}
                    style={styles.info}
                    disabled={refreshing}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text variant="body" bold>
                        {languageLabel(pair.target_language)}
                      </Text>
                      <Icon name="arrow-forward" size="sm" color={colors.onSurfaceVariant} />
                      <Text variant="body" bold>
                        {languageLabel(pair.display_language)}
                      </Text>
                    </View>
                    {pair.is_active && (
                      <View
                        style={[
                          styles.activeBadge,
                          { backgroundColor: colors.primaryContainer },
                        ]}
                      >
                        <Text variant="caption" color="primary">{t('settings.active')}</Text>
                      </View>
                    )}
                  </Pressable>

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => handleEdit(pair)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                      disabled={refreshing}
                    >
                      <Icon name="create-outline" size="md" color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemove(pair)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                      disabled={refreshing}
                    >
                      <Icon name="trash-outline" size="md" color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        <Button
          label={t('settings.addLanguagePair')}
          iconLeft="add-circle-outline"
          onPress={() => navigation.navigate('AddLanguagePair')}
          fullWidth
          disabled={refreshing}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
});
