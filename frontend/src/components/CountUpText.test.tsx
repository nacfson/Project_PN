import React from 'react';
import { render, screen, act } from '@testing-library/react-native';

// Mock useTheme to isolate the component from ThemeProvider timers/effects
jest.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      onSurface: '#1c1b1f',
      onSurfaceVariant: '#49454f',
    },
    typography: {
      weights: {
        bold: '700',
      },
    },
  }),
}));

import { CountUpText } from './CountUpText';

describe('CountUpText Component', () => {
  it('renders initial value 0 and animates to target using real timers', async () => {
    await render(
      <CountUpText target={100} duration={10} />
    );

    // Initial render is 0
    expect(screen.getByText('0')).toBeTruthy();

    // Wait for the interval to complete (duration is 10ms, step is 16ms, so 50ms is plenty)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Should reach the target value
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('cleans up interval on unmount', async () => {
    const mockClearInterval = jest.fn().mockImplementation((id) => {
      clearInterval(id);
    });

    const { unmount } = await render(
      <CountUpText target={100} duration={1000} _clearInterval={mockClearInterval} />
    );

    // Let React layout/paint effects run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Flush unmount cleanups
    await act(async () => {
      unmount();
    });

    expect(mockClearInterval).toHaveBeenCalled();
  });
});
