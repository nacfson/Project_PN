import { Platform } from 'react-native';

// API base URL resolution per platform.
// - web / desktop (Tauri renders the web bundle, Platform.OS === 'web'): localhost
// - iOS simulator: localhost reaches the host machine
// - Android emulator: 10.0.2.2 is the host loopback alias
// A physical device should override this with its host's LAN IP.
const DEFAULT_PORT = 8080;

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return Platform.select({
    web: `http://localhost:${DEFAULT_PORT}`,
    ios: `http://localhost:${DEFAULT_PORT}`,
    android: `http://10.0.2.2:${DEFAULT_PORT}`,
    default: `http://localhost:${DEFAULT_PORT}`,
  }) as string;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const DEFAULT_LANGUAGE_CODE = 'en';
export const DEFAULT_DEFINITION_LANGUAGE_CODE = 'ko';
