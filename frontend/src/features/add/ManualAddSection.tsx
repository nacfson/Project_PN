import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { PosSelector } from '../../components/PosSelector';
import { SensePicker } from '../../components/SensePicker';
import { useSenseFlow } from '../../hooks/useSenseFlow';
import { useAppLanguage } from '../../i18n';
import { shellKind, shellLayout } from '../../navigation/shellKind';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, Input, Kbd, Text } from '../../ui';
import type { PosFilter } from '../../types';

interface ManualAddSectionProps {
  selectedDeckId: string | null;
  targetLanguage: string;
  resolveDeckId?: () => Promise<string | null>;
  autoFocus?: boolean;
}

function isMultiWord(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length > 1;
}

export function ManualAddSection({
  selectedDeckId,
  targetLanguage,
  resolveDeckId,
  autoFocus = true,
}: ManualAddSectionProps) {
  const { colors, spacing, radii, shadows } = useTheme();
  const { t } = useAppLanguage();
  const { width } = useWindowDimensions();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isWide = shellLayout(shellKind(Platform.OS, ua), width) === 'sidebar' && width >= 640;

  const [word, setWord] = useState('');
  const [context, setContext] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [pos, setPos] = useState<PosFilter>('Any');
  const [posTouched, setPosTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  const {
    pickerVisible,
    query,
    options,
    lookingUp,
    confirming,
    error,
    suggestPosPrompt,
    lookup,
    forceExisting,
    forceWithPos,
    confirm,
    close,
  } = useSenseFlow({
    onAdded: () => {
      setWord('');
      setContext('');
      setPersonalNote('');
      setValidationError(null);
      setTouched(false);
      setPosTouched(false);
      setPos('Any');
    },
  });

  useEffect(() => {
    if (posTouched) return;
    if (isMultiWord(word)) {
      setPos('phrase');
    } else if (pos === 'phrase') {
      setPos('Any');
    }
  }, [word, pos, posTouched]);

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return t('add.wordRequired');
    }
    if (/[0-9_]/.test(trimmed)) {
      return t('add.validationInvalidWord');
    }
    return null;
  };

  const handleBlur = () => {
    setTouched(true);
    setValidationError(validate(word));
  };

  const handleChangeText = (text: string) => {
    setWord(text);
    if (touched || validationError) {
      setValidationError(validate(text));
    }
  };

  const findSense = () => {
    const trimmed = word.trim();
    const err = validate(trimmed);
    if (err) {
      setValidationError(err);
      setTouched(true);
      return;
    }
    const lookupPos: PosFilter = !posTouched && isMultiWord(trimmed) ? 'phrase' : pos;
    void lookup(trimmed, lookupPos, context.trim() || undefined, targetLanguage, selectedDeckId || undefined);
  };

  const busy = lookingUp || confirming;

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.surfaceCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.hairline,
            borderRadius: radii.card,
          },
          shadows.playful,
        ]}
      >
        <View style={[styles.topAccentBar, { backgroundColor: colors.brandPrimary }]} />
        <View style={styles.cardBody}>
          <View
            style={[
              styles.heroRow,
              {
                flexDirection: isWide ? 'row' : 'column',
                alignItems: isWide ? 'flex-start' : 'stretch',
              },
            ]}
          >
            <View style={styles.inputFlex} testID="manual-add-input-wrapper">
              <Input
                variant="display"
                value={word}
                onChangeText={handleChangeText}
                onBlur={handleBlur}
                error={!!validationError}
                helperText={validationError || undefined}
                placeholder={t('add.inputPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={autoFocus}
                onSubmitEditing={findSense}
                returnKeyType="search"
                onClear={() => {
                  setWord('');
                  setValidationError(null);
                  setTouched(false);
                }}
              />
              <Text
                variant="caption"
                color="secondary"
                testID="manual-add-phrase-hint"
                style={{ marginTop: 6, marginLeft: 4 }}
              >
                {t('add.phraseSupportHint')}
              </Text>
            </View>
            <Button
              label={t('add.findMeanings')}
              variant="primary"
              size="hero"
              hint={isWide && Platform.OS === 'web' ? <Kbd color={colors.onPrimary}>Enter</Kbd> : undefined}
              onPress={findSense}
              disabled={word.trim().length === 0 || busy}
              loading={lookingUp}
              testID="find-meanings-button"
              fullWidth={!isWide}
            />
          </View>

          <View style={[styles.disclosureBlock, { borderTopColor: colors.divider }]}>
            <Pressable
              onPress={() => setContextExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ expanded: contextExpanded }}
              testID="add-context-disclosure"
              style={styles.disclosureTrigger}
            >
              <Icon
                name={contextExpanded ? 'chevron-down' : 'chevron-forward'}
                size="sm"
                color={colors.text}
              />
              <Text variant="bodySmall" style={{ fontWeight: '500' }}>
                {t('add.addContext')}
              </Text>
              <Text variant="bodySmall" color="muted">
                {t('add.addContextHint')}
              </Text>
            </Pressable>

            {contextExpanded ? (
              <View style={[styles.contextGrid, { paddingTop: spacing.md, gap: 14 }]}>
                <View style={styles.fullWidthField}>
                  <Text variant="caption" style={styles.fieldLabel}>
                    {t('add.whereSaw')}
                  </Text>
                  <Input
                    value={context}
                    onChangeText={setContext}
                    placeholder={t('add.whereSawPlaceholder')}
                    onClear={() => setContext('')}
                  />
                </View>

                <View style={styles.halfField}>
                  <Text variant="caption" style={styles.fieldLabel}>
                    {t('add.ownWording')}
                  </Text>
                  <Input
                    value={personalNote}
                    onChangeText={setPersonalNote}
                    placeholder={t('add.ownWordingPlaceholder')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onClear={() => setPersonalNote('')}
                  />
                </View>

                <View style={styles.halfField}>
                  <Text variant="caption" style={styles.fieldLabel}>
                    {t('add.partOfSpeech')}
                  </Text>
                  <PosSelector
                    value={pos}
                    onChange={(next) => {
                      setPosTouched(true);
                      setPos(next);
                    }}
                  />
                  {!posTouched && isMultiWord(word) ? (
                    <Text variant="caption" color="muted">
                      {t('add.phrasePosHint')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <SensePicker
        visible={pickerVisible}
        query={query}
        options={options}
        lookingUp={lookingUp}
        confirming={confirming}
        errorMessage={error}
        suggestPosPrompt={suggestPosPrompt}
        sourceContext={context}
        onSourceContextChange={setContext}
        onConfirm={async (wordSenseId) => {
          let deckId = selectedDeckId;
          if (!deckId && resolveDeckId) {
            deckId = await resolveDeckId();
          }
          if (!deckId) return;
          void confirm(
            wordSenseId,
            deckId,
            context.trim() || undefined,
            personalNote.trim() || undefined,
          );
        }}
        onForceExisting={forceExisting}
        onForceWithPos={forceWithPos}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  surfaceCard: {
    borderWidth: 2,
    overflow: 'hidden',
  },
  topAccentBar: {
    height: 6,
    width: '100%',
  },
  cardBody: {
    padding: 24,
    gap: 16,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 10,
  },
  inputFlex: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 320,
  },
  disclosureBlock: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 4,
  },
  disclosureTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 32,
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fullWidthField: {
    width: '100%',
    gap: 6,
  },
  halfField: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
    gap: 6,
  },
  fieldLabel: {
    fontWeight: '500',
  },
});
