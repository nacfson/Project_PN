import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BrowserFrame, BROWSER_PAGE_WIDTH } from './browserFrame';
import { PhoneFrame } from './phoneFrame';

let mockWidth = 1200;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 2, fontScale: 1 }),
}));

it('centers a 420 page inside a full-width shell', async () => {
  mockWidth = 1200;
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

it('scales the page when the window is narrower than 420', async () => {
  mockWidth = 300;
  await render(<BrowserFrame><Text>Learn</Text></BrowserFrame>);
  expect(screen.getByTestId('browser-shell').props.style).toEqual(
    expect.objectContaining({ width: '100%', alignItems: 'center' }),
  );
  expect(screen.getByTestId('browser-frame').props.style).toEqual(
    expect.objectContaining({ transform: [{ scale: 300 / 420 }] }),
  );
});
