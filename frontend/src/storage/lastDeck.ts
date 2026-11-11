import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const LAST_DECK_KEY_PREFIX = 'project_pn_last_deck';

let memoryCache: Record<string, string> = {};

function storageKey(targetLanguage?: string | null): string {
  return targetLanguage
    ? `${LAST_DECK_KEY_PREFIX}_${targetLanguage}`
    : `${LAST_DECK_KEY_PREFIX}_default`;
}

async function readRaw(key: string): Promise<string | null> {
  if (memoryCache[key]) {
    return memoryCache[key];
  }
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const val = localStorage.getItem(key);
    if (val) {
      memoryCache[key] = val;
    }
    return val;
  }
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val) {
      memoryCache[key] = val;
    }
    return val;
  } catch {
    return null;
  }
}

async function writeRaw(key: string, value: string): Promise<void> {
  memoryCache[key] = value;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Non-fatal if storage fails
  }
}

export async function getLastDeckId(targetLanguage?: string | null): Promise<string | null> {
  const key = storageKey(targetLanguage);
  return readRaw(key);
}

export function getLastDeckIdSync(targetLanguage?: string | null): string | null {
  const key = storageKey(targetLanguage);
  if (memoryCache[key]) {
    return memoryCache[key];
  }
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const val = localStorage.getItem(key);
    if (val) {
      memoryCache[key] = val;
      return val;
    }
  }
  return null;
}

export async function setLastDeckId(deckId: string, targetLanguage?: string | null): Promise<void> {
  const key = storageKey(targetLanguage);
  await writeRaw(key, deckId);
}

export function clearLastDeckCacheForTest(): void {
  memoryCache = {};
}
