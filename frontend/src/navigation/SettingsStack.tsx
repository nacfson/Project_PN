import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { LanguagePairsScreen } from '../features/profile/LanguagePairsScreen';
import { AddLanguagePairScreen } from '../features/profile/AddLanguagePairScreen';
import { EditLanguagePairScreen } from '../features/profile/EditLanguagePairScreen';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';

export type SettingsStackParamList = {
  SettingsRoot: undefined;
  LanguagePairs: undefined;
  AddLanguagePair: undefined;
  EditLanguagePair: { targetLanguage: string; displayLanguage: string };
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

interface SettingsStackProps {
  onLogout: () => void;
}

export function SettingsStack({ onLogout }: SettingsStackProps) {
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
        name="SettingsRoot"
        options={{ headerShown: false }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen
        name="LanguagePairs"
        component={LanguagePairsScreen}
        options={{ title: t('settings.languagePairs') }}
      />
      <Stack.Screen
        name="AddLanguagePair"
        component={AddLanguagePairScreen}
        options={{ title: t('settings.addLanguagePair') }}
      />
      <Stack.Screen
        name="EditLanguagePair"
        component={EditLanguagePairScreen}
        options={{ title: t('settings.editLanguagePair') }}
      />
    </Stack.Navigator>
  );
}
