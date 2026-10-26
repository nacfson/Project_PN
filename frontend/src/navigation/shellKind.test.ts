import { browserPageWidth, browserScale, shellKind } from './shellKind';

it('keeps a narrow desktop window on the browser page', () => {
  expect(shellKind('web', 'Mozilla/5.0 Macintosh')).toBe('browser');
  expect(shellKind('web', '')).toBe('browser');
});

it('sends native and phone browsers to the phone screen', () => {
  expect(shellKind('ios', '')).toBe('phone');
  expect(shellKind('android', '')).toBe('phone');
  expect(shellKind('web', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile')).toBe('phone');
});

it('does not treat iPad web or a missing width as phone', () => {
  expect(shellKind('web', 'Mozilla/5.0 (iPad) AppleWebKit')).toBe('browser');
  expect(browserScale(0)).toBe(1);
  expect(browserScale(300)).toBeCloseTo(300 / 420);
  expect(browserScale(900)).toBe(1);
});

it('sizes the browser page from the window width', () => {
  expect(browserPageWidth(300)).toBe(420);
  expect(browserPageWidth(420)).toBe(420);
  expect(browserPageWidth(900)).toBe(900);
  expect(browserPageWidth(2560)).toBe(1200);
});
