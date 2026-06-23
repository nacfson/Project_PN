import { Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui';
import type { ImportAction, ImportPreviewItem, SenseOption } from '../../types';

interface ImportConflictPickerProps {
  item: ImportPreviewItem;
  selectedAction: ImportAction;
  onSelect: (action: ImportAction) => void;
}

export function ImportConflictPicker({ item, selectedAction, onSelect }: ImportConflictPickerProps) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderRadius: radii.xxl,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <View>
        <Text variant="body" bold>
          {item.front}
        </Text>
        <Text variant="caption" color="muted">
          {item.back}
        </Text>
      </View>

      {item.matched_senses.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="muted">
            {t('import.existingMeanings')}
          </Text>
          {item.matched_senses.map((sense: SenseOption) => (
            <Text key={sense.word_sense_id} variant="caption">
              • {sense.definition}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {item.status === 'conflict' && item.matched_senses.length > 0 && (
          <ActionButton
            label={t('import.overwriteMeaning')}
            action="overwrite_meaning"
            selectedAction={selectedAction}
            onSelect={onSelect}
          />
        )}
        {(item.status === 'conflict' || item.status === 'existing_word_match') && (
          <ActionButton
            label={t('import.createNewMeaning')}
            action="create_new_meaning"
            selectedAction={selectedAction}
            onSelect={onSelect}
          />
        )}
        {item.status === 'new_word' && (
          <ActionButton
            label={t('import.add')}
            action="add"
            selectedAction={selectedAction}
            onSelect={onSelect}
          />
        )}
        <ActionButton
          label={t('import.skip')}
          action="skip"
          selectedAction={selectedAction}
          onSelect={onSelect}
        />
      </View>
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  action: ImportAction;
  selectedAction: ImportAction;
  onSelect: (action: ImportAction) => void;
}

function ActionButton({ label, action, selectedAction, onSelect }: ActionButtonProps) {
  const { colors, spacing, radii } = useTheme();
  const selected = selectedAction === action;

  return (
    <Pressable
      onPress={() => onSelect(action)}
      style={[
        styles.action,
        {
          borderRadius: radii.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: selected ? colors.secondaryContainer : 'transparent',
          borderColor: selected ? 'transparent' : colors.outline,
          borderWidth: 1,
        },
      ]}
    >
      <Text variant="caption" color={selected ? 'onSecondaryContainer' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
