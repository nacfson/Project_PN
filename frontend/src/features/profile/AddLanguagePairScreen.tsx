import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getLanguageOptions } from '../../api/auth';
import { addUserLanguage } from '../../api/userLanguages';
import { SUPPORTED_LANGUAGES } from '../../config';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, LoadingState, Screen, Switch, Text } from '../../ui';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';

export function AddLanguagePairScreen() {
  const { colors, spacing } = useTheme();
  const { t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const [targetOptions, setTargetOptions] = useState<string[]>([]);
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | undefined>();
  const [selectedDisplay, setSelectedDisplay] = useState<string | undefined>();
  const [setActive, setSetActive] = useState(true);
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
        if (options.defaults.target_language) {
          setSelectedTarget(options.defaults.target_language);
        }
        if (options.defaults.definition_language) {
          setSelectedDisplay(options.defaults.definition_language);
        }
      } catch {
        setError(t('settings.loadLanguageOptionsFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const toggleTarget = (code: string) => {
    setSelectedTarget((prev) => (prev === code ? undefined : code));
  };

  const toggleDisplay = (code: string) => {
    setSelectedDisplay((prev) => (prev === code ? undefined : code));
  };

  const handleSave = async () => {
    if (!selectedTarget || !selectedDisplay) {
      setError(t('settings.languagePairRequired'));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await addUserLanguage(selectedTarget, selectedDisplay, setActive);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
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

  const renderOption = (code: string, selected: boolean, onToggle: (code: string) => void) => (
    <Button
      key={code}
      label={languageLabel(code)}
      variant={selected ? 'primary' : 'tonal'}
      onPress={() => onToggle(code)}
      style={{ flex: 1 }}
    />
  );

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">{t('settings.addLanguagePair')}</Text>
          <Text variant="caption" color="muted">
            {t('settings.addLanguagePairDescription')}
          </Text>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Text variant="label">{t('settings.targetLanguage')}</Text>
          <View style={styles.optionsGrid}>
            {targetOptions.map((code) => renderOption(code, selectedTarget === code, toggleTarget))}
          </View>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="label">{t('settings.displayLanguage')}</Text>
          <View style={styles.optionsGrid}>
            {displayOptions.map((code) => renderOption(code, selectedDisplay === code, toggleDisplay))}
          </View>
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="body">{t('settings.setActiveOnAdd')}</Text>
          <Switch value={setActive} onValueChange={setSetActive} />
        </Card>

        {error ? (
          <Text variant="caption" color="danger">{error}</Text>
        ) : null}

        <Button
          label={t('settings.save')}
          onPress={() => void handleSave()}
          loading={saving}
          disabled={!selectedTarget || !selectedDisplay}
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
