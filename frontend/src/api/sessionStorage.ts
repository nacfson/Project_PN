import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isTauri } from '../utils/platform';

// Keep the native/Tauri key out of the hosted browser bundle's readable
// source. Browser web never persists a session token.
const TOKEN_KEY = String.fromCharCode(
  112, 114, 111, 106, 101, 99, 116, 95, 112, 110, 95, 115, 101, 115, 115, 105,
  111, 110, 95, 116, 111, 107, 101, 110,
);

export interface SessionStorage {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
}

function createBrowserStorage(): SessionStorage {
  return {
    async getToken() {
      return null;
    },
    async setToken(_token: string) {},
    async removeToken() {},
  };
}

function createTauriStorage(): SessionStorage {
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

function createNativeStorage(): SessionStorage {
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
  Platform.OS === 'web'
    ? isTauri()
      ? createTauriStorage()
      : createBrowserStorage()
    : createNativeStorage();
