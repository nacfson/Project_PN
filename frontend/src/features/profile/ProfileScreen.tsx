import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { logout, me } from '../../api/auth';
import { getReviewSettings, updateReviewSettings } from '../../api/reviewSettings';
import { type AppLanguage, useAppLanguage } from '../../i18n';
import type { MeResponse } from '../../types/auth';
import { isTauri } from '../../utils/platform';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Card, Icon, LoadingState, Screen, Text } from '../../ui';

const RETENTION_MIN = 0.8;
const RETENTION_MAX = 0.95;
const RETENTION_DEFAULT = 0.9;
const RETENTION_RANGE = RETENTION_MAX - RETENTION_MIN;

function clampRetention(value: number): number {
  return Math.max(RETENTION_MIN, Math.min(RETENTION_MAX, value));
}

function retentionToPercent(value: number): number {
  return (clampRetention(value) - RETENTION_MIN) / RETENTION_RANGE;
}

function percentToRetention(percent: number): number {
  const raw = RETENTION_MIN + Math.max(0, Math.min(1, percent)) * RETENTION_RANGE;
  return Math.round(raw * 100) / 100;
}

function formatRetentionPercent(value: number): string {
  return `${Math.round(clampRetention(value) * 100)}%`;
}

interface RetentionSliderProps {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

function RetentionSlider({ value, disabled, onChange, onCommit }: RetentionSliderProps) {
  const { colors, spacing } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const isDesktop = Platform.OS === 'web' || isTauri();
  const handleSize = 36 * (isDesktop ? 1.25 : 1);
  const trackHeight = isDesktop ? 10 : 8;
  const wrapperHeight = Math.max(handleSize, trackHeight + 12);
  const startPercent = useRef(retentionToPercent(value));
  const handleScale = useRef(new Animated.Value(1)).current;
  const latestValue = useRef(value);

  latestValue.current = value;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        startPercent.current = retentionToPercent(latestValue.current);
        Animated.spring(handleScale, {
          toValue: 1.15,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const maxLeft = trackWidth - handleSize;
        if (maxLeft <= 0) return;

        const startX = startPercent.current * maxLeft;
        let targetX = startX + gestureState.dx;
        targetX = Math.max(0, Math.min(maxLeft, targetX));

        onChange(percentToRetention(targetX / maxLeft));
      },
      onPanResponderRelease: () => {
        Animated.spring(handleScale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
        onCommit(latestValue.current);
      },
      onPanResponderTerminate: () => {
        Animated.spring(handleScale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const currentPercent = retentionToPercent(value);
  const maxLeft = trackWidth - handleSize;
  const leftPos = maxLeft > 0 ? currentPercent * maxLeft : 0;

  const handleTrackPress = (locationX: number) => {
    if (disabled || trackWidth <= 0) return;
    const next = percentToRetention(locationX / trackWidth);
    onChange(next);
    onCommit(next);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={retentionSliderStyles.labels}>
        <Text variant="caption" color="muted">
          {formatRetentionPercent(RETENTION_MIN)}
        </Text>
        <Text variant="body" style={{ color: colors.primary, fontWeight: '700' }}>
          {formatRetentionPercent(value)}
        </Text>
        <Text variant="caption" color="muted">
          {formatRetentionPercent(RETENTION_MAX)}
        </Text>
      </View>
      <Pressable
        onPress={(e) => handleTrackPress(e.nativeEvent.locationX)}
        disabled={disabled}
        style={{ opacity: disabled ? 0.6 : 1 }}
      >
        <View
          style={[retentionSliderStyles.trackWrapper, { height: wrapperHeight }]}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <View style={[retentionSliderStyles.track, { backgroundColor: colors.border, height: trackHeight }]} />
          <View
            style={[
              retentionSliderStyles.fill,
              {
                width: `${currentPercent * 100}%`,
                backgroundColor: colors.primary,
                height: trackHeight,
              },
            ]}
          />
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              retentionSliderStyles.handle,
              {
                left: leftPos,
                width: handleSize,
                height: handleSize,
                borderRadius: handleSize / 2,
                borderColor: colors.primary,
                backgroundColor: colors.surface,
                marginTop: -handleSize / 2,
                transform: [{ scale: handleScale }],
              },
            ]}
          />
        </View>
      </Pressable>
    </View>
  );
}

interface ProfileScreenProps {
  onLogout: () => void;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: spacing.md,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: danger ? colors.dangerSurface : colors.surfaceAlt }]}>
        <Icon name={icon} size="md" color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text variant="body" style={{ color: danger ? colors.danger : colors.text }}>
          {label}
        </Text>
        {value ? (
          <Text variant="caption" color="muted">
            {value}
          </Text>
        ) : null}
      </View>
      {onPress && <Icon name="chevron-forward" size="sm" />}
    </Pressable>
  );
}

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const { colors, spacing } = useTheme();
  const { language, setLanguage, t } = useAppLanguage();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [desiredRetention, setDesiredRetention] = useState(RETENTION_DEFAULT);
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const savedRetentionRef = useRef(RETENTION_DEFAULT);

  useEffect(() => {
    void (async () => {
      await Promise.all([
        me()
          .then((profile) => setUser(profile))
          .catch(() => setUser(null)),
        getReviewSettings()
          .then((settings) => {
            const next = clampRetention(settings.desired_retention);
            savedRetentionRef.current = next;
            setDesiredRetention(next);
          })
          .catch(() => {
            // Keep default; backend route may not be deployed yet.
          }),
      ]);
      setLoading(false);
    })();
  }, []);

  const commitRetention = useCallback(
    async (nextValue: number) => {
      const clamped = clampRetention(nextValue);
      if (clamped === savedRetentionRef.current) {
        setRetentionError(null);
        return;
      }

      setSavingRetention(true);
      setRetentionError(null);
      try {
        const updated = await updateReviewSettings({ desired_retention: clamped });
        const saved = clampRetention(updated.desired_retention);
        savedRetentionRef.current = saved;
        setDesiredRetention(saved);
      } catch {
        setDesiredRetention(savedRetentionRef.current);
        setRetentionError(t('settings.desiredRetentionSaveFailed'));
      } finally {
        setSavingRetention(false);
      }
    },
    [t],
  );

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  }, [onLogout]);

  const languageLabel = useCallback(
    (code: string | undefined) => {
      switch (code) {
        case 'en':
          return t('language.enLearning');
        case 'ko':
          return t('language.koLearning');
        case 'ja':
          return t('language.jaLearning');
        case 'es':
          return t('language.esLearning');
        case 'fr':
          return t('language.frLearning');
        case 'de':
          return t('language.deLearning');
        case 'zh':
          return t('language.zhLearning');
        default:
          return code || t('common.unknown');
      }
    },
    [t],
  );

  const chooseLanguage = useCallback(
    (nextLanguage: AppLanguage) => {
      void setLanguage(nextLanguage);
      setShowLanguageSelector(false);
    },
    [setLanguage],
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingVertical: spacing.lg, gap: spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="heading">{t('settings.title')}</Text>

        <Card>
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text variant="label" color="muted">
              {t('settings.account')}
            </Text>
          </View>
          <SettingRow icon="person-outline" label={t('settings.email')} value={user?.email ?? t('common.unknown')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="language-outline" label={t('settings.learningLanguage')} value={languageLabel(user?.target_language)} />
        </Card>

        <Card>
          <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
            <Text variant="label" color="muted">
              {t('settings.review')}
            </Text>
            <Text variant="body">{t('settings.desiredRetention')}</Text>
            <Text variant="caption" color="muted">
              {t('settings.desiredRetentionHelp')}
            </Text>
          </View>
          <RetentionSlider
            value={desiredRetention}
            disabled={savingRetention}
            onChange={setDesiredRetention}
            onCommit={(next) => void commitRetention(next)}
          />
          {retentionError ? (
            <Text variant="caption" style={{ color: colors.danger, marginTop: spacing.sm }}>
              {retentionError}
            </Text>
          ) : null}
        </Card>

        <Card>
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text variant="label" color="muted">
              {t('settings.app')}
            </Text>
          </View>
          <SettingRow
            icon="language-outline"
            label={t('settings.appLanguage')}
            value={language === 'ko' ? t('language.ko') : t('language.en')}
            onPress={() => setShowLanguageSelector((visible) => !visible)}
          />
          {showLanguageSelector ? (
            <View style={[styles.languageOptions, { gap: spacing.sm }]}>
              <Button
                label={t('language.en')}
                variant={language === 'en' ? 'primary' : 'secondary'}
                onPress={() => chooseLanguage('en')}
              />
              <Button
                label={t('language.ko')}
                variant={language === 'ko' ? 'primary' : 'secondary'}
                onPress={() => chooseLanguage('ko')}
              />
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="help-circle-outline" label={t('settings.help')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="information-circle-outline" label={t('settings.about')} />
        </Card>

        <Button
          label={t('settings.logout')}
          variant="danger"
          loading={loggingOut}
          onPress={() => void handleLogout()}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  divider: {
    height: 1,
    marginLeft: 48,
    marginVertical: 4,
  },
  languageOptions: {
    marginLeft: 48,
    marginVertical: 8,
  },
});

const retentionSliderStyles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackWrapper: {
    justifyContent: 'center',
  },
  track: {
    borderRadius: 999,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    left: 0,
    borderRadius: 999,
  },
  handle: {
    position: 'absolute',
    borderWidth: 2,
    top: '50%',
  },
});
