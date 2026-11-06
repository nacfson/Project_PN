import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../../i18n';
import { radii, spacing, useTheme } from '../../theme';
import type { ImportError, ImportPreviewItem } from '../../types';
import { Button, Text } from '../../ui';
import { ImportConflictPicker } from './ImportConflictPicker';
import { useAnkiImport } from './useAnkiImport';

interface AnkiImportScreenProps {
  languageCode?: string;
  definitionLanguageCode?: string;
}

export function AnkiImportScreen({
  languageCode = 'en',
  definitionLanguageCode = 'ko',
}: AnkiImportScreenProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [showHelp, setShowHelp] = useState(false);

  const {
    csvText,
    setCsvText,
    preview,
    actions,
    loading,
    importing,
    error,
    result,
    previewFromText,
    setCardAction,
    importCards,
    reset,
  } = useAnkiImport({ languageCode, definitionLanguageCode });

  const hasConflicts = preview?.items.some((item: ImportPreviewItem) => item.status === 'conflict');

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom },
        ]}
      >
        <View style={{ gap: spacing.md }}>
          <View style={styles.headerRow}>
            <Text variant="sectionTitle">{t('import.title')}</Text>
            <Pressable onPress={() => setShowHelp((v) => !v)} hitSlop={8}>
              <Text variant="caption" color={colors.accent}>
                {showHelp ? t('common.close') : t('import.help')}
              </Text>
            </Pressable>
          </View>

          {showHelp && (
            <View
              style={[
                styles.helpBox,
                {
                  backgroundColor: colors.fill,
                  borderRadius: radii.md,
                  padding: spacing.md,
                },
              ]}
            >
              <Text variant="caption" color={colors.textSecondary}>
                {t('import.helpText')}
              </Text>
            </View>
          )}

          {!preview && !result && (
            <View style={{ gap: spacing.md }}>
              <Text variant="body" color={colors.textSecondary}>
                {t('import.pasteInstructions')}
              </Text>

              <View
                style={[
                  styles.textAreaWrapper,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.controlBorder,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <TextInput
                  value={csvText}
                  onChangeText={setCsvText}
                  placeholder={t('import.csvPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                  style={[
                    styles.textArea,
                    {
                      padding: spacing.md,
                      color: colors.text,
                      fontSize: 14,
                    },
                  ]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Button
                label={t('import.preview')}
                onPress={previewFromText}
                loading={loading}
                disabled={!csvText.trim() || loading}
              />
            </View>
          )}

          {error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.dangerSurface,
                  borderRadius: radii.md,
                  padding: spacing.md,
                },
              ]}
            >
              <Text variant="body" color={colors.danger}>
                {error}
              </Text>
            </View>
          )}

          {preview && (
            <View style={{ gap: spacing.md }}>
              <View style={styles.headerRow}>
                <Text variant="body" bold>
                  {t('import.reviewTitle', { count: preview.cards.length })}
                </Text>
                <Pressable onPress={reset} hitSlop={8}>
                  <Text variant="caption" color={colors.accent}>
                    {t('import.startOver')}
                  </Text>
                </Pressable>
              </View>

              {hasConflicts && (
                <Text variant="caption" color={colors.textSecondary}>
                  {t('import.conflictHint')}
                </Text>
              )}

              <View style={{ gap: spacing.md }}>
                {preview.items.map((item: ImportPreviewItem) => (
                  <ImportConflictPicker
                    key={item.index}
                    item={item}
                    selectedAction={actions[item.index] ?? item.suggested_action}
                    onSelect={(action) => setCardAction(item.index, action)}
                  />
                ))}
              </View>

              <Button
                label={t('import.import')}
                onPress={importCards}
                loading={importing}
                disabled={importing}
              />
            </View>
          )}

          {result && (
            <View
              style={[
                styles.resultBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.hairline,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  gap: spacing.md,
                },
              ]}
            >
              <Text variant="sectionTitle">{t('import.complete')}</Text>
              <Text variant="body">
                {t('import.summary', {
                  imported: result.imported,
                  skipped: result.skipped,
                  failed: result.failed,
                })}
              </Text>
              {result.errors.length > 0 && (
                <View style={{ gap: spacing.xs }}>
                  {result.errors.slice(0, 5).map((err: ImportError) => (
                    <Text key={err.index} variant="caption" color={colors.danger}>
                      {err.front}: {err.error}
                    </Text>
                  ))}
                </View>
              )}
              <Button label={t('import.importMore')} onPress={reset} variant="secondary" />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textAreaWrapper: {
    borderWidth: 1,
    minHeight: 200,
  },
  textArea: {
    flex: 1,
    minHeight: 200,
  },
  helpBox: {
    width: '100%',
  },
  errorBox: {
    width: '100%',
  },
  resultBox: {
    width: '100%',
  },
});
