import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CAPTURE_HISTORY_KEY = 'project_pn_capture_history';
const MAX_ENTRIES = 40;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface CaptureHistoryEntry {
  word: string;
  capturedAt: string;
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(CAPTURE_HISTORY_KEY);
  }
  try {
    return await SecureStore.getItemAsync(CAPTURE_HISTORY_KEY);
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CAPTURE_HISTORY_KEY, value);
    }
    return;
  }
  await SecureStore.setItemAsync(CAPTURE_HISTORY_KEY, value);
}

function prune(entries: CaptureHistoryEntry[]): CaptureHistoryEntry[] {
  const cutoff = Date.now() - RETENTION_MS;
  const filtered = entries.filter((entry) => new Date(entry.capturedAt).getTime() >= cutoff);
  return filtered.slice(0, MAX_ENTRIES);
}

export async function loadCaptureHistory(): Promise<CaptureHistoryEntry[]> {
  const raw = await readRaw();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as CaptureHistoryEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return prune(parsed);
  } catch {
    return [];
  }
}

export async function recordCapturedWords(words: string[]): Promise<void> {
  const normalized = words
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 0);
  if (normalized.length === 0) {
    return;
  }

  const existing = await loadCaptureHistory();
  const now = new Date().toISOString();
  const next = [...existing];
  for (const word of normalized) {
    if (next.some((entry) => entry.word === word)) {
      continue;
    }
    next.unshift({ word, capturedAt: now });
  }
  await writeRaw(JSON.stringify(prune(next)));
}

export async function recentCaptureWords(limit = 8): Promise<string[]> {
  const entries = await loadCaptureHistory();
  return entries.slice(0, limit).map((entry) => entry.word);
}
