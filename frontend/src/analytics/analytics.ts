import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createAnalyticsEvent, createUUID, type AnalyticsEvent, type AnalyticsEventName, type AnalyticsPlatform } from '@project-pn/api';
import { postJson } from '../api/client';
import { isTauri } from '../utils/platform';

const MAX_BATCH_EVENTS = 100;

interface AnalyticsClientOptions {
  enabled: boolean;
  platform: AnalyticsPlatform;
  appVersion: string;
  upload: (events: AnalyticsEvent[]) => Promise<void>;
}

export interface AnalyticsClient {
  track(eventName: AnalyticsEventName, properties: Record<string, unknown>, traceId?: string): string;
  flush(): Promise<void>;
}

export function createAnalyticsClient(options: AnalyticsClientOptions): AnalyticsClient {
  const sessionId = createUUID();
  // A new identifier per app boot deliberately keeps pre-login tracking
  // pseudonymous while still joining one journey across its screens.
  const anonymousId = createUUID();
  let pending: AnalyticsEvent[] = [];
  let flushing: Promise<void> | null = null;

  const flush = async (): Promise<void> => {
    if (!options.enabled || pending.length === 0) return;
    if (flushing) return flushing;
    const events = pending.splice(0, MAX_BATCH_EVENTS);
    flushing = options.upload(events).catch(() => {
      // First-release analytics is intentionally best effort: no product flow
      // waits for it and no client retry queue retains learning content.
    }).finally(() => {
      flushing = null;
      if (pending.length >= MAX_BATCH_EVENTS) void flush();
    });
    return flushing;
  };

  return {
    track(eventName, properties, traceId = createUUID()) {
      if (!options.enabled) return traceId;
      const event = createAnalyticsEvent({
        eventName,
        sessionId,
        traceId,
        anonymousId,
        platform: options.platform,
        appVersion: options.appVersion,
        properties,
      });
      pending.push(event);
      if (pending.length >= MAX_BATCH_EVENTS) void flush();
      return traceId;
    },
    flush,
  };
}

function resolvePlatform(): AnalyticsPlatform {
  if (isTauri()) return 'tauri';
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

const analyticsEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'true';

export const analytics = createAnalyticsClient({
  enabled: analyticsEnabled,
  platform: resolvePlatform(),
  appVersion: Constants.expoConfig?.version ?? 'unknown',
  upload: async (events) => {
    await postJson('/api/analytics/events', { events });
  },
});
