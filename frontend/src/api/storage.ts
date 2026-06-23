import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'project_pn_session_token';
const APP_LANGUAGE_KEY = 'project_pn_app_language';

/** Abstraction for session token persistence. Web uses localStorage; native uses SecureStore. */
export interface SessionStorage {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
}

function createWebStorage(): SessionStorage {
  return {
    async getToken() {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(TOKEN_KEY);
    },
    async setToken(token: string) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
      }
    },
    async removeToken() {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
    },
  };
}

function createSecureStorage(): SessionStorage {
  return {
    async getToken() {
      return SecureStore.getItemAsync(TOKEN_KEY);
    },
    async setToken(token: string) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    },
    async removeToken() {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    },
  };
}

export const sessionStorage: SessionStorage =
  Platform.OS === 'web' ? createWebStorage() : createSecureStorage();

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
