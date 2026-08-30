import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PosSelector } from '../../components/PosSelector';
import { SensePicker } from '../../components/SensePicker';
import { useSenseFlow } from '../../hooks/useSenseFlow';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Input, Text } from '../../ui';
import type { PosFilter } from '../../types';

interface ManualAddSectionProps {
  selectedDeckId: string;
  targetLanguage: string;
}

export function ManualAddSection({ selectedDeckId, targetLanguage }: ManualAddSectionProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [word, setWord] = useState('');
  const [context, setContext] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const {
    pickerVisible,
    query,
    options,
    generating,
    error,
    lookup,
    forceExisting,
    forceWithPos,
    confirm,
    close,
  } = useSenseFlow({
    onAdded: () => {
      setWord('');
      setContext('');
      setValidationError(null);
      setTouched(false);
    },
  });

  const handleBlur = () => {
    setTouched(true);
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      setValidationError(t('add.wordRequired'));
    } else if (/[0-9_]/.test(trimmed)) {
      setValidationError(t('add.validationInvalidWord'));
    } else {
      setValidationError(null);
    }
  };

  const handleChangeText = (text: string) => {
    setWord(text);
    if (touched || validationError) {
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setValidationError(t('add.wordRequired'));
      } else if (/[0-9_]/.test(trimmed)) {
        setValidationError(t('add.validationInvalidWord'));
      } else {
        setValidationError(null);
      }
    }
  };

  const findSense = () => {
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      setValidationError(t('add.wordRequired'));
      return;
    }
    if (/[0-9_]/.test(trimmed)) {
      setValidationError(t('add.validationInvalidWord'));
      return;
    }
    void lookup(trimmed, pos, context.trim() || undefined, targetLanguage, selectedDeckId);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: spacing.lg }]}>
      <Text variant="title" style={{ marginBottom: spacing.md }}>
        {t('add.addOneWord')}
      </Text>

      <View style={{ marginBottom: spacing.md }} testID="manual-add-input-wrapper">
        <Input
          value={word}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          error={!!validationError}
          helperText={validationError || undefined}
          placeholder={t('add.wordPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={findSense}
          returnKeyType="search"
          onClear={() => {
            setWord('');
            setValidationError(null);
            setTouched(false);
          }}
        />
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <Text variant="label" color="muted" style={{ marginBottom: spacing.xs }}>
          {t('add.contextLabel')}
        </Text>
        <Input
          value={context}
          onChangeText={setContext}
          placeholder={t('add.contextPlaceholder')}
          multiline
          numberOfLines={3}
          style={{ minHeight: 72 }}
          onClear={() => setContext('')}
        />
      </View>

      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <Text variant="label" color="muted">{t('add.partOfSpeechOptional')}</Text>
        <PosSelector value={pos} onChange={setPos} />
      </View>

      <Button
        label={t('add.findMySense')}
        onPress={findSense}
        disabled={word.trim().length === 0 || generating}
        loading={generating}
      />

      <SensePicker
        visible={pickerVisible}
        query={query}
        options={options}
        generating={generating}
        errorMessage={error}
        sourceContext={context}
        onSourceContextChange={setContext}
        onConfirm={(wordSenseId) => {
          void confirm(wordSenseId, selectedDeckId, context.trim() || undefined);
        }}
        onForceExisting={forceExisting}
        onForceWithPos={forceWithPos}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
});
