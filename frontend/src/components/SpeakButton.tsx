import { Platform, Pressable, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useAppLanguage } from '../i18n';
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
      hitSlop={12}
      accessibilityLabel={t('common.listen')}
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="volume-high" color={colors.primary} size={size === 'sm' ? 'sm' : 'md'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    padding: 6,
  },
});
