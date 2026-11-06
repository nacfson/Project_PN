import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { stageColor } from '../../theme/tokens';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import type { StatsSummary } from '../../types';
import { Text } from '../../ui';
import { totalWords } from './todaySummary';

const MASTERY_STAGES = [
  'new',
  'learning',
  'recognized',
  'recalled',
  'usable',
  'mastered',
] as const;

type MasteryStage = (typeof MASTERY_STAGES)[number];

const STAGE_LABEL_KEYS: Record<MasteryStage, TranslationKey> = {
  new: 'home.stage.new',
  learning: 'home.stage.learning',
  recognized: 'home.stage.recognized',
  recalled: 'home.stage.recalled',
  usable: 'home.stage.usable',
  mastered: 'home.stage.mastered',
};

export interface MasteryBarProps {
  stageCounts: StatsSummary['stage_counts'];
}

export function MasteryBar({ stageCounts }: MasteryBarProps) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();

  const segments = MASTERY_STAGES.map((stageKey) => ({
    key: stageKey,
    label: t(STAGE_LABEL_KEYS[stageKey]),
    count: stageCounts?.[stageKey] ?? 0,
    color: stageColor(stageKey),
  }));

  const total = totalWords(stageCounts);
  const summaryLabel = segments
    .map((s) => `${s.count} ${s.label.toLowerCase()}`)
    .join(', ');

  return (
    <View style={{ gap: spacing.md }}>
      <View
        accessibilityRole="image"
        accessibilityLabel={summaryLabel}
        style={[
          styles.track,
          {
            backgroundColor: colors.hairline,
          },
        ]}
      >
        {total > 0
          ? segments.map((seg) =>
              seg.count > 0 ? (
                <View
                  key={seg.key}
                  style={{
                    flex: seg.count,
                    backgroundColor: seg.color,
                  }}
                />
              ) : null,
            )
          : null}
      </View>

      {total === 0 ? (
        <Text variant="caption" color="muted">
          {t('today.noWordsYet')}
        </Text>
      ) : null}

      <View style={styles.legend}>
        {segments.map((seg) => (
          <View key={seg.key} style={styles.legendItem}>
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor: seg.color,
                },
              ]}
            />
            <Text variant="caption" color="muted">
              {seg.label}
            </Text>
            <Text variant="caption" tabular style={{ color: colors.text }}>
              {seg.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    width: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
