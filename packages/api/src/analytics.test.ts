import { createAnalyticsEvent, validateAnalyticsEvent } from './analytics';

const baseInput = {
  eventName: 'word_lookup_succeeded',
  sessionId: '8d30c572-0d28-43ef-98c1-98d7d49b7f93',
  traceId: 'd01bb929-6f39-4d3e-bb53-ecc3d87d337d',
  anonymousId: '7678227c-f627-473d-9dd1-06bc2ae79497',
  platform: 'web' as const,
  appVersion: '1.0.0',
  properties: { word: 'learn' },
};

test('creates a versioned analytics event matching the transport contract', () => {
  const event = createAnalyticsEvent({ ...baseInput, eventId: '6ea32d0e-3c6b-4e0d-9fe1-3a57e7d468f1' });

  expect(event).toMatchObject({
    event_name: 'word_lookup_succeeded',
    event_version: 1,
    event_id: '6ea32d0e-3c6b-4e0d-9fe1-3a57e7d468f1',
    properties: { word: 'learn' },
  });
  expect(validateAnalyticsEvent(event)).toBeUndefined();
});

test('rejects unknown event names and credential properties before transport', () => {
  expect(() => createAnalyticsEvent({ ...baseInput, eventName: 'unknown_event' })).toThrow('event_name');
  expect(() => createAnalyticsEvent({ ...baseInput, properties: { access_token: 'secret' } })).toThrow('forbidden');
});
