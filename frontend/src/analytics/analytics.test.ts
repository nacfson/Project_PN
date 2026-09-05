import { createAnalyticsClient } from './analytics';

test('buffers semantic events and drops transport failures without rejecting the caller', async () => {
  const sent: unknown[] = [];
  const client = createAnalyticsClient({
    enabled: true,
    platform: 'web',
    appVersion: '1.0.0',
    upload: async (events) => { sent.push(events); },
  });

  const traceId = client.track('word_lookup_requested', { word: 'learn', source_context: 'a context' });
  await client.flush();

  expect(traceId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(sent).toEqual([[
    expect.objectContaining({
      event_name: 'word_lookup_requested',
      trace_id: traceId,
      properties: { word: 'learn', source_context: 'a context' },
    }),
  ]]);
});

test('does not emit when analytics is disabled', async () => {
  const upload = jest.fn();
  const client = createAnalyticsClient({ enabled: false, platform: 'web', appVersion: '1.0.0', upload });

  client.track('screen_viewed', { screen: 'words' });
  await client.flush();

  expect(upload).not.toHaveBeenCalled();
});
