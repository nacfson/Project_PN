export const ANALYTICS_EVENT_VERSION = 1;

export const ANALYTICS_EVENT_NAMES = [
  'session_started', 'session_ended', 'screen_viewed', 'command_invoked', 'command_completed',
  'validation_failed', 'validation_succeeded', 'auth_started', 'auth_succeeded', 'auth_failed',
  'verification_started', 'verification_succeeded', 'verification_failed', 'word_capture_started',
  'word_capture_completed', 'word_lookup_requested', 'word_lookup_succeeded', 'word_lookup_failed',
  'meaning_search_requested', 'meaning_search_succeeded', 'meaning_search_failed', 'sense_selected',
  'sense_changed', 'word_add_requested', 'word_add_succeeded', 'word_add_failed', 'card_revealed',
  'card_rated', 'review_succeeded', 'review_failed', 'deck_created', 'deck_renamed', 'deck_moved',
  'deck_deleted', 'settings_changed', 'api_request_completed', 'api_request_failed', 'error_displayed',
  'retry_requested',
] as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENT_NAMES[number];
export type AnalyticsPlatform = 'web' | 'ios' | 'android' | 'tauri' | 'extension' | 'backend';

export interface AnalyticsEvent {
  event_name: AnalyticsEventName;
  event_version: number;
  event_id: string;
  occurred_at: string;
  session_id: string;
  trace_id: string;
  anonymous_id: string;
  authenticated_user_id?: string;
  platform: AnalyticsPlatform;
  app_version: string;
  properties: Record<string, unknown>;
}

export interface CreateAnalyticsEventInput {
  eventName: AnalyticsEventName | string;
  eventId?: string;
  occurredAt?: string;
  sessionId: string;
  traceId: string;
  anonymousId: string;
  platform: AnalyticsPlatform;
  appVersion: string;
  properties: Record<string, unknown>;
}

const eventNames = new Set<string>(ANALYTICS_EVENT_NAMES);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const forbiddenKeys = new Set([
  'token', 'access_token', 'refresh_token', 'id_token', 'password', 'secret', 'authorization', 'cookie', 'set_cookie',
]);

export function createAnalyticsEvent(input: CreateAnalyticsEventInput): AnalyticsEvent {
  const event: AnalyticsEvent = {
    event_name: input.eventName as AnalyticsEventName,
    event_version: ANALYTICS_EVENT_VERSION,
    event_id: input.eventId ?? createUUID(),
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    session_id: input.sessionId,
    trace_id: input.traceId,
    anonymous_id: input.anonymousId,
    platform: input.platform,
    app_version: input.appVersion,
    properties: input.properties,
  };
  validateAnalyticsEvent(event);
  return event;
}

export function validateAnalyticsEvent(event: AnalyticsEvent): void {
  if (!eventNames.has(event.event_name)) throw new Error('event_name is not registered');
  if (event.event_version !== ANALYTICS_EVENT_VERSION) throw new Error('event_version is invalid');
  for (const [name, value] of Object.entries({
    event_id: event.event_id, session_id: event.session_id, trace_id: event.trace_id, anonymous_id: event.anonymous_id,
  })) {
    if (!uuidPattern.test(value)) throw new Error(`${name} must be a UUID`);
  }
  if (Number.isNaN(Date.parse(event.occurred_at))) throw new Error('occurred_at must be RFC3339');
  if (!event.app_version || event.app_version.length > 128) throw new Error('app_version is required');
  if (!event.properties || Array.isArray(event.properties)) throw new Error('properties is required');
  if (containsForbiddenProperty(event.properties)) throw new Error('properties contains a forbidden credential field');
}

function containsForbiddenProperty(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenProperty);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([key, nested]) =>
      forbiddenKeys.has(key.toLowerCase().replaceAll('-', '_')) || containsForbiddenProperty(nested),
    );
  }
  return false;
}

export function createUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
