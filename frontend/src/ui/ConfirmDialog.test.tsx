import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { BROWSER_PAGE_MAX_WIDTH } from '../navigation/shellKind';
import { colors } from '../theme/tokens';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  afterEach(async () => {
    await cleanup();
  });

  const baseProps = {
    visible: true,
    title: 'Remove this word?',
    body: "This can't be undone.",
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
    tone: 'danger' as const,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when visible is false', async () => {
    await render(
      <ThemeProvider>
        <ConfirmDialog {...baseProps} visible={false} />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });

  it('renders title, body, Cancel button, and danger-styled confirm button', async () => {
    await render(
      <ThemeProvider>
        <ConfirmDialog {...baseProps} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Remove this word?')).toBeTruthy();
    expect(screen.getByText("This can't be undone.")).toBeTruthy();
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeTruthy();
    const confirmBtn = screen.getByTestId('confirm-dialog-confirm');
    expect(confirmBtn).toBeTruthy();
    expect(StyleSheet.flatten(confirmBtn.props.style)).toEqual(
      expect.objectContaining({ backgroundColor: colors.danger }),
    );
  });

  it('calls onConfirm once when confirm is pressed', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ThemeProvider>
        <ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByTestId('confirm-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel on Cancel button and backdrop press, and never onConfirm', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ThemeProvider>
        <ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByTestId('confirm-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('confirm-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed on web', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const origWin = (globalThis as any).window;
    (globalThis as any).window = {
      ...origWin,
      addEventListener: (type: string, fn: (e: any) => void) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: (e: any) => void) => {
        listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
      },
    };

    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    try {
      const { unmount } = await render(
        <ThemeProvider>
          <ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />
        </ThemeProvider>,
      );

      for (const fn of listeners.keydown || []) {
        fn({
          key: 'Escape',
          preventDefault: jest.fn(),
          target: { tagName: 'DIV' },
        });
      }
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
      await unmount();
    } finally {
      (globalThis as any).window = origWin;
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('applies PAGE_WIDTH_FRAME to testID="confirm-dialog"', async () => {
    await render(
      <ThemeProvider>
        <ConfirmDialog {...baseProps} />
      </ThemeProvider>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('confirm-dialog').props.style)).toEqual(
      expect.objectContaining({
        width: '100%',
        maxWidth: BROWSER_PAGE_MAX_WIDTH,
        alignSelf: 'center',
      }),
    );
  });
});
