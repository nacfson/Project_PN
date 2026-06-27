import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { MyWordsScreen } from '../features/words/MyWordsScreen';
import { WordDetailScreen } from '../features/words/WordDetailScreen';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import type { LearningItemListItem } from '../types';

export type WordsStackParamList = {
  WordsRoot: undefined;
  WordDetail: { item: LearningItemListItem };
};

const Stack = createNativeStackNavigator<WordsStackParamList>();

export function WordsStack() {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  const screenOptions: NativeStackNavigationOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.surfaceContainer },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.onSurface },
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
    </Stack.Navigator>
  );
}
