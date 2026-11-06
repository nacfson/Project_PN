import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getLanguageOptions } from '../../api/auth';
import { ApiError } from '../../api/client';
import { addUserLanguage } from '../../api/userLanguages';
import { SUPPORTED_LANGUAGES } from '../../config';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppLanguage } from '../../i18n';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { spacing, useTheme } from '../../theme';
import {
  Button,
  Card,
  LoadingState,
  PageColumn,
  Screen,
  SettingsGroup,
  SettingsRow,
  Switch,
  Text,
} from '../../ui';

export function AddLanguagePairScreen() {
  const { colors } = useTheme();
  const { t, languageLabel } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const { refresh } = useLanguage();
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

  const renderOption = (code: string, selected: boolean, onToggle: (code: string) => void) => (
    <Button
      key={code}
      label={languageLabel(code)}
      variant={selected ? 'primary' : 'secondary'}
      onPress={() => onToggle(code)}
      style={{ flex: 1 }}
    />
  );

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={{ paddingVertical: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <PageColumn style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="pageTitle">{t('settings.addLanguagePair')}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {t('settings.addLanguagePairDescription')}
            </Text>
          </View>

          <Card style={{ gap: spacing.md }}>
            <Text variant="groupLabel">{t('settings.targetLanguage')}</Text>
            <View style={styles.optionsGrid}>
              {targetOptions.map((code) => renderOption(code, selectedTarget === code, toggleTarget))}
            </View>
          </Card>

          <Card style={{ gap: spacing.md }}>
            <Text variant="groupLabel">{t('settings.displayLanguage')}</Text>
            <View style={styles.optionsGrid}>
              {displayOptions.map((code) =>
                renderOption(code, selectedDisplay === code, toggleDisplay),
              )}
            </View>
          </Card>

          <SettingsGroup>
            <SettingsRow
              title={t('settings.setActiveOnAdd')}
              trailing={<Switch value={setActive} onValueChange={setSetActive} />}
            />
          </SettingsGroup>

          {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}

          <Button
            label={t('settings.save')}
            onPress={() => void handleSave()}
            loading={saving}
            disabled={!selectedTarget || !selectedDisplay}
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
