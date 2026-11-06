import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { PAGE_WIDTH_FRAME, shellKind, shellLayout } from '../../navigation/shellKind';
import { radii, spacing, useTheme } from '../../theme';
import type { Deck } from '../../types';
import { Icon, Text } from '../../ui';

export interface DeckFilterMenuProps {
  decks: Deck[];
  selectedDeckId: string | null;
  deckCounts?: Map<string, number>;
  totalWordsCount?: number;
  onSelectDeck: (deckId: string | null) => void;
  onNewDeck: () => void;
  onManageDecks: () => void;
  defaultOpen?: boolean;
}

export function DeckFilterMenu({
  decks,
  selectedDeckId,
  deckCounts,
  totalWordsCount,
  onSelectDeck,
  onNewDeck,
  onManageDecks,
  defaultOpen = false,
}: DeckFilterMenuProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(defaultOpen);

  const ua =
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isPhoneSheet = shellLayout(shellKind(Platform.OS, ua), width) === 'bottom';

  const selectedDeck = selectedDeckId ? decks.find((d) => d.id === selectedDeckId) : null;
  const currentLabel = selectedDeck ? selectedDeck.name : t('words.allDecks');

  const handleSelect = (deckId: string | null) => {
    setOpen(false);
    onSelectDeck(deckId);
  };

  const handleNewDeck = () => {
    setOpen(false);
    onNewDeck();
  };

  const handleManageDecks = () => {
    setOpen(false);
    onManageDecks();
  };

  const menuContent = (
    <>
      <Pressable
        testID="deck-filter-option-all"
        accessibilityRole="menuitem"
        accessibilityState={{ selected: selectedDeckId === null }}
        onPress={() => handleSelect(null)}
        style={({ pressed }) => [
          styles.menuRow,
          selectedDeckId === null && { backgroundColor: colors.infoSurface },
          pressed && { backgroundColor: colors.fill },
        ]}
      >
        <Text
          variant="body"
          color={selectedDeckId === null ? colors.accent : colors.text}
          style={selectedDeckId === null ? styles.selectedText : undefined}
        >
          {t('words.allDecks')}
        </Text>
        {typeof totalWordsCount === 'number' ? (
          <Text variant="caption" tabular color={colors.textSecondary}>
            {totalWordsCount}
          </Text>
        ) : null}
      </Pressable>

      {decks.map((deck) => {
        const isSelected = selectedDeckId === deck.id;
        const count = deckCounts?.get(deck.id) ?? deck.item_count ?? 0;
        return (
          <Pressable
            key={deck.id}
            testID={`deck-filter-option-${deck.id}`}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: isSelected }}
            onPress={() => handleSelect(deck.id)}
            style={({ pressed }) => [
              styles.menuRow,
              isSelected && { backgroundColor: colors.infoSurface },
              pressed && { backgroundColor: colors.fill },
            ]}
          >
            <Text
              variant="body"
              color={isSelected ? colors.accent : colors.text}
              style={isSelected ? styles.selectedText : undefined}
              numberOfLines={1}
            >
              {deck.name}
            </Text>
            <Text variant="caption" tabular color={colors.textSecondary}>
              {count}
            </Text>
          </Pressable>
        );
      })}

      <View style={[styles.separator, { backgroundColor: colors.hairline }]} />

      <Pressable
        testID="deck-filter-new-deck"
        accessibilityRole="menuitem"
        onPress={handleNewDeck}
        style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.fill }]}
      >
        <View style={styles.actionRowInner}>
          <Icon name="add-outline" size={16} color={colors.textSecondary} />
          <Text variant="body" color={colors.text}>
            {t('words.newDeck')}
          </Text>
        </View>
      </Pressable>

      <Pressable
        testID="deck-filter-manage-decks"
        accessibilityRole="menuitem"
        onPress={handleManageDecks}
        style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.fill }]}
      >
        <View style={styles.actionRowInner}>
          <Icon name="albums-outline" size={16} color={colors.textSecondary} />
          <Text variant="body" color={colors.text}>
            {t('words.manageDecks')}
          </Text>
        </View>
      </Pressable>
    </>
  );

  return (
    <View style={styles.wrapper}>
      <Pressable
        testID="deck-filter-trigger"
        accessibilityRole="button"
        accessibilityLabel={currentLabel}
        onPress={() => setOpen((prev) => !prev)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: pressed ? colors.fill : colors.surface,
            borderColor: colors.controlBorder,
          },
        ]}
      >
        <Text variant="bodySmall" style={styles.triggerText} numberOfLines={1}>
          {currentLabel}
        </Text>
        <Icon name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>

      {open && !isPhoneSheet ? (
        <View
          testID="deck-filter-menu"
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surface,
              borderColor: colors.controlBorder,
            },
          ]}
        >
          <ScrollView style={styles.dropdownScroll}>{menuContent}</ScrollView>
        </View>
      ) : null}

      {open && isPhoneSheet ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.modalRoot}>
            <Pressable
              testID="deck-filter-backdrop"
              style={[styles.backdrop, { backgroundColor: colors.scrim }]}
              onPress={() => setOpen(false)}
            />
            <View
              testID="bottom-sheet"
              style={[
                styles.sheet,
                PAGE_WIDTH_FRAME,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.hairline,
                },
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text variant="sectionTitle">{t('words.decksTitle')}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  onPress={() => setOpen(false)}
                  hitSlop={8}
                >
                  <Icon name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView style={styles.sheetScroll}>{menuContent}</ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 20,
  },
  trigger: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  triggerText: {
    fontWeight: '500',
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 220,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    zIndex: 50,
  },
  dropdownScroll: {
    maxHeight: 320,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sheetScroll: {
    maxHeight: 360,
  },
  menuRow: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectedText: {
    fontWeight: '600',
  },
  separator: {
    height: 1,
    marginVertical: spacing.xs,
  },
  actionRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
