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
