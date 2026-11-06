import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { DecksScreen } from '../features/words/DecksScreen';
import { MyWordsScreen } from '../features/words/MyWordsScreen';
import { WordDetailScreen } from '../features/words/WordDetailScreen';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import type { LearningItemListItem } from '../types';

export type WordsStackParamList = {
  WordsRoot: { deckId?: string } | undefined;
  WordDetail: { item: LearningItemListItem };
  Decks: undefined;
};

const Stack = createNativeStackNavigator<WordsStackParamList>();

export function WordsStack() {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  const screenOptions: NativeStackNavigationOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.text },
    contentStyle: { flex: 1, backgroundColor: colors.canvas },
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="WordsRoot"
        component={MyWordsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WordDetail"
        component={WordDetailScreen}
        options={{ title: t('words.detailTitle') }}
      />
      <Stack.Screen
        name="Decks"
        component={DecksScreen}
        options={{ title: t('words.decksTitle') }}
      />
    </Stack.Navigator>
  );
}
