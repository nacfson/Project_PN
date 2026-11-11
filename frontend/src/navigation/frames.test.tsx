import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BrowserFrame, BROWSER_PAGE_WIDTH } from './browserFrame';
import { PhoneFrame } from './phoneFrame';

let mockWidth = 1200;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 2, fontScale: 1 }),
}));

it('keeps the page at 420 when the window is exactly 420', async () => {
  mockWidth = 420;
  expect(BROWSER_PAGE_WIDTH).toBe(420);
  await render(<BrowserFrame><Text>Learn</Text></BrowserFrame>);
  expect(screen.getByTestId('browser-shell').props.style).toEqual(
    expect.objectContaining({ width: '100%', alignItems: 'center' }),
  );
  expect(screen.getByTestId('browser-frame').props.style).toEqual(
    expect.objectContaining({ width: 420 }),
  );
  await render(<PhoneFrame><Text>Learn</Text></PhoneFrame>);
  expect(screen.getByTestId('phone-frame').props.style.width).not.toBe(420);
});

it('scales the page and compensates height when the window is narrower than 420', async () => {
  mockWidth = 300;
  await render(<BrowserFrame><Text>Learn</Text></BrowserFrame>);
  expect(screen.getByTestId('browser-shell').props.style).toEqual(
    expect.objectContaining({ width: '100%', alignItems: 'center' }),
  );
  expect(screen.getByTestId('browser-frame').props.style).toEqual(
    expect.objectContaining({
      transform: [{ scale: 300 / 420 }],
      height: 800 / (300 / 420),
    }),
  );
});

it('grows the page with a wide window up to 1200', async () => {
  mockWidth = 900;
  await render(<BrowserFrame><Text>Learn</Text></BrowserFrame>);
  expect(screen.getByTestId('browser-frame').props.style).toEqual(
    expect.objectContaining({ width: 900, transform: [{ scale: 1 }] }),
  );
  mockWidth = 1920;
  await render(<BrowserFrame><Text>Learn</Text></BrowserFrame>);
  expect(screen.getByTestId('browser-frame').props.style).toEqual(
    expect.objectContaining({ width: 1200 }),
  );
});

it('does not give the phone frame the browser page width', async () => {
  mockWidth = 900;
  await render(<PhoneFrame><Text>Learn</Text></PhoneFrame>);
  expect(screen.getByTestId('phone-frame').props.style.width).toBe('100%');
});
