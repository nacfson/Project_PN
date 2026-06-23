import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Icon, Text } from '../ui';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();
  const [step, setStep] = useState(0);

  const slides: Array<{ icon: React.ComponentProps<typeof Icon>['name']; title: string; description: string }> = [
    {
      icon: 'book-outline',
      title: t('onboarding.slide1.title'),
      description: t('onboarding.slide1.description'),
    },
    {
      icon: 'school-outline',
      title: t('onboarding.slide2.title'),
      description: t('onboarding.slide2.description'),
    },
    {
      icon: 'trophy-outline',
      title: t('onboarding.slide3.title'),
      description: t('onboarding.slide3.description'),
    },
  ];

  const isLast = step === slides.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.slide}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
            <Icon name={slides[step].icon} size="xl" color={colors.primary} />
          </View>
          <Text variant="headline" style={[styles.title, { color: colors.onSurface }]}>
            {slides[step].title}
          </Text>
          <Text variant="body" color="muted" style={styles.description}>
            {slides[step].description}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={[styles.dots, { gap: spacing.sm }]}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === step ? colors.primary : colors.outlineVariant,
                    width: index === step ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <Button
            label={isLast ? t('onboarding.getStarted') : t('onboarding.next')}
            fullWidth
            onPress={() => {
              if (isLast) {
                onComplete();
              } else {
                setStep((prev) => prev + 1);
              }
            }}
          />

          {!isLast && (
            <Pressable onPress={onComplete} style={styles.skip}>
              <Text variant="caption" color="muted">
                {t('onboarding.skip')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  footer: {
    gap: 16,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  skip: {
    paddingVertical: 8,
  },
});
