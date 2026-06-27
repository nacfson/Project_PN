import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getLanguageOptions } from '../../api/auth';
import { updateLanguagePair } from '../../api/userLanguages';
import { SUPPORTED_LANGUAGES } from '../../config';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, LoadingState, Screen, Text } from '../../ui';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';

export function EditLanguagePairScreen() {
  const { colors, spacing } = useTheme();
  const { t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const route = useRoute<RouteProp<SettingsStackParamList, 'EditLanguagePair'>>();
  const { targetLanguage, displayLanguage } = route.params;

  const [targetOptions, setTargetOptions] = useState<string[]>([]);
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState(targetLanguage);
  const [selectedDisplay, setSelectedDisplay] = useState(displayLanguage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [hasDataError, setHasDataError] = useState(false);

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
    setHasDataError(false);
  };

  const toggleDisplay = (code: string) => {
    setSelectedDisplay(code);
    setHasDataError(false);
  };

  const hasChanges = selectedTarget !== targetLanguage || selectedDisplay !== displayLanguage;

  const handleSave = async () => {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    setError(undefined);
    setHasDataError(false);
    try {
      await updateLanguagePair(targetLanguage, selectedTarget, selectedDisplay);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (typeof message === 'string' && message.toLowerCase().includes('has learning data')) {
        setHasDataError(true);
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
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">{t('settings.editLanguagePair')}</Text>
          <Text variant="caption" color="muted">
            {t('settings.editLanguagePairDescription')}
          </Text>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Text variant="label">{t('settings.targetLanguage')}</Text>
          <View style={styles.optionsGrid}>
            {targetOptions.map((code) => (
              <Button
                key={code}
                label={languageLabel(code)}
                variant={selectedTarget === code ? 'primary' : 'tonal'}
                onPress={() => toggleTarget(code)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="label">{t('settings.displayLanguage')}</Text>
          <View style={styles.optionsGrid}>
            {displayOptions.map((code) => (
              <Button
                key={code}
                label={languageLabel(code)}
                variant={selectedDisplay === code ? 'primary' : 'tonal'}
                onPress={() => toggleDisplay(code)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </Card>

        {hasDataError ? (
          <Card variant="outlined" style={{ gap: spacing.sm }}>
            <Text variant="body" color="danger">
              {t('settings.languagePairHasDataTitle')}
            </Text>
            <Text variant="caption" color="muted">
              {t('settings.languagePairHasDataMessage')}
            </Text>
            <Button
              label={t('settings.languagePairRemoveAndAdd')}
              variant="tonal"
              onPress={() => navigation.navigate('LanguagePairs')}
            />
          </Card>
        ) : null}

        {error ? (
          <Text variant="caption" color="danger">{error}</Text>
        ) : null}

        <Button
          label={t('settings.save')}
          onPress={() => void handleSave()}
          loading={saving}
          disabled={!selectedTarget || !selectedDisplay || !hasChanges}
          fullWidth
        />
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
