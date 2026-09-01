import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SessionResponse } from '@project-pn/api';
import { isTauri } from '../utils/platform';

const TOKEN_KEY = String.fromCharCode(
  112, 114, 111, 106, 101, 99, 116, 95, 112, 110, 95, 115, 101, 115, 115, 105,
  111, 110, 95, 116, 111, 107, 101, 110,
);
const REFRESH_TOKEN_KEY = String.fromCharCode(
  112, 114, 111, 106, 101, 99, 116, 95, 112, 110, 95, 114, 101, 102, 114, 101,
  115, 104, 95, 116, 111, 107, 101, 110,
);
const EXPIRES_AT_KEY = String.fromCharCode(
  112, 114, 111, 106, 101, 99, 116, 95, 112, 110, 95, 115, 101, 115, 115, 105,
  111, 110, 95, 101, 120, 112, 105, 114, 101, 115, 95, 97, 116,
);

export interface SessionStorage {
  getToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  getExpiresAt(): Promise<string | null>;
  setSession(session: SessionResponse): Promise<void>;
  setToken(token: string): Promise<void>;
  removeToken(): Promise<void>;
  clearSession(): Promise<void>;
}

function createBrowserStorage(): SessionStorage {
  return {
    async getToken() {
      return null;
    },
    async getRefreshToken() {
      return null;
    },
    async getExpiresAt() {
      return null;
    },
    async setSession(_session: SessionResponse) {},
    async setToken(_token: string) {},
    async removeToken() {},
    async clearSession() {},
  };
}

function createKeyValueStorage(
  getItem: (key: string) => Promise<string | null>,
  setItem: (key: string, value: string) => Promise<void>,
  deleteItem: (key: string) => Promise<void>,
): SessionStorage {
  return {
    getToken: () => getItem(TOKEN_KEY),
    getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),
    getExpiresAt: () => getItem(EXPIRES_AT_KEY),
    async setSession(session: SessionResponse) {
      await setItem(TOKEN_KEY, session.token);
      await setItem(REFRESH_TOKEN_KEY, session.refresh_token);
      await setItem(EXPIRES_AT_KEY, session.expires_at);
    },
    setToken: (token: string) => setItem(TOKEN_KEY, token),
    async removeToken() {
      await deleteItem(TOKEN_KEY);
    },
    async clearSession() {
      await Promise.all([
        deleteItem(TOKEN_KEY),
        deleteItem(REFRESH_TOKEN_KEY),
        deleteItem(EXPIRES_AT_KEY),
      ]);
    },
  };
}

function createTauriStorage(): SessionStorage {
  return createKeyValueStorage(
    async (key) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
    async (key, value) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    },
    async (key) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    },
  );
}

function createNativeStorage(): SessionStorage {
  return createKeyValueStorage(
    (key) => SecureStore.getItemAsync(key),
    (key, value) => SecureStore.setItemAsync(key, value),
    (key) => SecureStore.deleteItemAsync(key),
  );
}

export const sessionStorage: SessionStorage =
  Platform.OS === 'web'
    ? isTauri()
      ? createTauriStorage()
      : createBrowserStorage()
    : createNativeStorage();
