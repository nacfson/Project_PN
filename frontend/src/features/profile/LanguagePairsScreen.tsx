import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { removeUserLanguage } from '../../api/userLanguages';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppLanguage } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { spacing, useTheme } from '../../theme';
import type { UserLanguage } from '../../types/auth';
import {
  Badge,
  Button,
  Card,
  Icon,
  LoadingState,
  PageColumn,
  Screen,
  SettingsGroup,
  Text,
} from '../../ui';

export function LanguagePairsScreen() {
  const { colors } = useTheme();
  const { t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { languages, loading, isRefreshing, error, refresh, setActive } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const handleSetActive = async (targetLanguage: string) => {
    const currentActive = languages.find((p) => p.is_active)?.target_language;
    if (targetLanguage === currentActive) return;
    setRefreshing(true);
    try {
      await setActive(targetLanguage);
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
              await refresh();
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              Alert.alert(t('common.somethingWrong'), message);
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

  if (loading && languages.length === 0) {
    return (
      <Screen padded>
        <LoadingState />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen padded>
        <PageColumn style={{ gap: spacing.md }}>
          <Text variant="body" color={colors.danger}>{error}</Text>
          <Button label={t('common.retry')} onPress={refresh} />
        </PageColumn>
      </Screen>
    );
  }

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{ paddingVertical: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <PageColumn style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="pageTitle">{t('settings.languagePairs')}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {t('settings.languagePairsDescription')}
            </Text>
          </View>

          {(refreshing || isRefreshing) && (
            <View style={{ alignItems: 'center' }}>
              <Text variant="caption" color={colors.textSecondary}>{t('app.loading')}</Text>
            </View>
          )}

          {languages.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                {t('settings.noLanguagePairs')}
              </Text>
            </Card>
          ) : (
            <SettingsGroup>
              {languages.map((pair) => (
                <View key={pair.target_language} style={styles.row}>
                  <Pressable
                    onPress={() => handleSetActive(pair.target_language)}
                    style={styles.info}
                    disabled={refreshing}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text variant="body" bold>
                        {languageLabel(pair.target_language)}
                      </Text>
                      <Icon name="arrow-forward" size="sm" color={colors.textSecondary} />
                      <Text variant="body" bold>
                        {languageLabel(pair.display_language)}
                      </Text>
                    </View>
                    {pair.is_active && (
                      <Badge label={t('settings.active')} variant="accent" />
                    )}
                  </Pressable>

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => handleEdit(pair)}
                      style={({ pressed }: { pressed: boolean }) => [
                        styles.actionButton,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                      disabled={refreshing}
                    >
                      <Icon name="create-outline" size="md" color={colors.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemove(pair)}
                      style={({ pressed }: { pressed: boolean }) => [
                        styles.actionButton,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                      disabled={refreshing}
                    >
                      <Icon name="trash-outline" size="md" color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </SettingsGroup>
          )}

          <Button
            label={t('settings.addLanguagePair')}
            iconLeft="add-circle-outline"
            onPress={() => navigation.navigate('AddLanguagePair')}
            fullWidth
            disabled={refreshing}
          />
        </PageColumn>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
});
