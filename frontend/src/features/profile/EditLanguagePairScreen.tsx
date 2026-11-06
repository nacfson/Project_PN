import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getLanguageOptions } from '../../api/auth';
import { ApiError } from '../../api/client';
import { updateLanguagePair } from '../../api/userLanguages';
import { SUPPORTED_LANGUAGES } from '../../config';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppLanguage } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { spacing, useTheme } from '../../theme';
import { Button, Card, LoadingState, PageColumn, Screen, Text } from '../../ui';

export function EditLanguagePairScreen() {
  const { colors } = useTheme();
  const { t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const route = useRoute<RouteProp<SettingsStackParamList, 'EditLanguagePair'>>();
  const { refresh } = useLanguage();
  const { targetLanguage, displayLanguage } = route.params;

  const [targetOptions, setTargetOptions] = useState<string[]>([]);
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState(targetLanguage);
  const [selectedDisplay, setSelectedDisplay] = useState(displayLanguage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      try {
        const options = await getLanguageOptions();
        const allowedTarget = options.allowed.target_languages ?? [];
        const allowedDisplay = options.allowed.definition_languages ?? [];
        setTargetOptions(
          allowedTarget.length > 0 ? allowedTarget : SUPPORTED_LANGUAGES.map((l) => l.code),
        );
        setDisplayOptions(
          allowedDisplay.length > 0 ? allowedDisplay : SUPPORTED_LANGUAGES.map((l) => l.code),
        );
      } catch {
        setError(t('settings.loadLanguageOptionsFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const toggleTarget = (code: string) => {
    setSelectedTarget(code);
  };

  const toggleDisplay = (code: string) => {
    setSelectedDisplay(code);
  };

  const hasChanges = selectedTarget !== targetLanguage || selectedDisplay !== displayLanguage;

  const handleSave = async () => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await updateLanguagePair(targetLanguage, selectedTarget, selectedDisplay);
      refresh();
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes('already exists') ||
        (err instanceof ApiError && err.status === 409)
      ) {
        setError(t('settings.languagePairAlreadyExists'));
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
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
        contentContainerStyle={{ paddingVertical: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <PageColumn style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="pageTitle">{t('settings.editLanguagePair')}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {t('settings.editLanguagePairDescription')}
            </Text>
          </View>

          <Card style={{ gap: spacing.md }}>
            <Text variant="groupLabel">{t('settings.targetLanguage')}</Text>
            <View style={styles.optionsGrid}>
              {targetOptions.map((code) => (
                <Button
                  key={code}
                  testID={`target-language-${code}`}
                  label={languageLabel(code)}
                  variant={selectedTarget === code ? 'primary' : 'secondary'}
                  onPress={() => toggleTarget(code)}
                  style={{ flex: 1 }}
                />
              ))}
            </View>
          </Card>

          <Card style={{ gap: spacing.md }}>
            <Text variant="groupLabel">{t('settings.displayLanguage')}</Text>
            <View style={styles.optionsGrid}>
              {displayOptions.map((code) => (
                <Button
                  key={code}
                  label={languageLabel(code)}
                  variant={selectedDisplay === code ? 'primary' : 'secondary'}
                  onPress={() => toggleDisplay(code)}
                  style={{ flex: 1 }}
                />
              ))}
            </View>
          </Card>

          {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}

          <Button
            label={t('settings.save')}
            onPress={() => void handleSave()}
            loading={saving}
            disabled={!selectedTarget || !selectedDisplay || !hasChanges}
            fullWidth
          />
        </PageColumn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
