import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const APP_LANGUAGE_KEY = 'project_pn_app_language';

export interface AppLanguageStorage {
  getLanguage(): Promise<string | null>;
  setLanguage(language: string): Promise<void>;
}

function createWebAppLanguageStorage(): AppLanguageStorage {
  return {
    async getLanguage() {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(APP_LANGUAGE_KEY);
    },
    async setLanguage(language: string) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(APP_LANGUAGE_KEY, language);
      }
    },
  };
}

function createSecureAppLanguageStorage(): AppLanguageStorage {
  return {
    async getLanguage() {
      try {
        return await SecureStore.getItemAsync(APP_LANGUAGE_KEY);
      } catch {
        return null;
      }
    },
    async setLanguage(language: string) {
      await SecureStore.setItemAsync(APP_LANGUAGE_KEY, language);
    },
  };
}

export const appLanguageStorage: AppLanguageStorage =
  Platform.OS === 'web' ? createWebAppLanguageStorage() : createSecureAppLanguageStorage();

const LEGACY_THEME_KEYS = ['project_pn_theme_mode', 'project_pn_theme_variation'] as const;

export async function clearLegacyThemePreferences(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        for (const key of LEGACY_THEME_KEYS) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage errors
    }
    return;
  }

  await Promise.all(
    LEGACY_THEME_KEYS.map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore storage errors
      }
    }),
  );
}

const ONBOARDING_KEY = 'project_pn_onboarding_completed';

export interface OnboardingStorage {
  getCompleted(): Promise<boolean>;
  setCompleted(completed: boolean): Promise<void>;
}

function createWebOnboardingStorage(): OnboardingStorage {
  return {
    async getCompleted() {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      return localStorage.getItem(ONBOARDING_KEY) === 'true';
    },
    async setCompleted(completed) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ONBOARDING_KEY, completed ? 'true' : 'false');
      }
    },
  };
}

function createSecureOnboardingStorage(): OnboardingStorage {
  return {
    async getCompleted() {
      try {
        const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
        return value === 'true';
      } catch {
        return false;
      }
    },
    async setCompleted(completed) {
      await SecureStore.setItemAsync(ONBOARDING_KEY, completed ? 'true' : 'false');
    },
  };
}

export const onboardingStorage: OnboardingStorage =
  Platform.OS === 'web' ? createWebOnboardingStorage() : createSecureOnboardingStorage();
