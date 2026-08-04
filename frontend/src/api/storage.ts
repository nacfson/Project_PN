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

const THEME_MODE_KEY = 'project_pn_theme_mode';

export interface ThemeModeStorage {
  getMode(): Promise<'light' | 'dark' | null>;
  setMode(mode: 'light' | 'dark'): Promise<void>;
}

function createWebThemeModeStorage(): ThemeModeStorage {
  return {
    async getMode() {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      const value = localStorage.getItem(THEME_MODE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    },
    async setMode(mode) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_MODE_KEY, mode);
      }
    },
  };
}

function createSecureThemeModeStorage(): ThemeModeStorage {
  return {
    async getMode() {
      try {
        const value = await SecureStore.getItemAsync(THEME_MODE_KEY);
        return value === 'light' || value === 'dark' ? value : null;
      } catch {
        return null;
      }
    },
    async setMode(mode) {
      await SecureStore.setItemAsync(THEME_MODE_KEY, mode);
    },
  };
}

export const themeModeStorage: ThemeModeStorage =
  Platform.OS === 'web' ? createWebThemeModeStorage() : createSecureThemeModeStorage();

const THEME_VARIATION_KEY = 'project_pn_theme_variation';

export interface ThemeVariationStorage {
  getVariation(): Promise<string | null>;
  setVariation(variation: string): Promise<void>;
}

function createWebThemeVariationStorage(): ThemeVariationStorage {
  return {
    async getVariation() {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(THEME_VARIATION_KEY);
    },
    async setVariation(variation) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_VARIATION_KEY, variation);
      }
    },
  };
}

function createSecureThemeVariationStorage(): ThemeVariationStorage {
  return {
    async getVariation() {
      try {
        return await SecureStore.getItemAsync(THEME_VARIATION_KEY);
      } catch {
        return null;
      }
    },
    async setVariation(variation) {
      await SecureStore.setItemAsync(THEME_VARIATION_KEY, variation);
    },
  };
}

export const themeVariationStorage: ThemeVariationStorage =
  Platform.OS === 'web' ? createWebThemeVariationStorage() : createSecureThemeVariationStorage();

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
