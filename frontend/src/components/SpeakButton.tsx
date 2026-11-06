import { Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useAppLanguage } from '../i18n';
import { shellKind, shellLayout } from '../navigation/shellKind';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui';

interface SpeakButtonProps {
  text: string;
  language: string;
  size?: 'sm' | 'md';
}

export function SpeakButton({ text, language, size = 'md' }: SpeakButtonProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { width } = useWindowDimensions();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isPhone = shellLayout(shellKind(Platform.OS, ua), width) === 'bottom';
  const dimension = isPhone ? 44 : size === 'sm' ? 32 : 36;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      Speech.stop();
      Speech.speak(text, { language, pitch: 1.0, rate: 0.9 });
    } catch {
      // Best-effort: ignore TTS errors (e.g., missing language pack).
    }
  };

  return (
    <Pressable
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={t('practice.playPronunciation')}
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderColor: pressed ? colors.text : colors.controlBorder,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon name="volume-medium-outline" color={colors.text} size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
