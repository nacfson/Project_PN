import React from 'react';
import { Platform, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useKeyboardShortcut } from './useKeyboardShortcut';

function ShortcutHarness({
  shortcutKey,
  onTrigger,
  enabled = true,
}: {
  shortcutKey: string | string[];
  onTrigger: (e: KeyboardEvent) => void;
  enabled?: boolean;
}) {
  useKeyboardShortcut(shortcutKey, onTrigger, { enabled });
  return React.createElement(View, { testID: 'harness' });
}

describe('useKeyboardShortcut', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  let listeners: Array<(e: KeyboardEvent) => void> = [];

  beforeEach(() => {
    listeners = [];
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });
    const win = ((globalThis as unknown as { window?: Record<string, unknown> }).window ??
      ((globalThis as unknown as { window: Record<string, unknown> }).window = {}));
    win.IS_REACT_ACT_ENVIRONMENT = true;
    win.addEventListener = jest.fn((event: string, cb: (e: KeyboardEvent) => void) => {
      if (event === 'keydown') {
        listeners.push(cb);
      }
    });
    win.removeEventListener = jest.fn((event: string, cb: (e: KeyboardEvent) => void) => {
      if (event === 'keydown') {
        listeners = listeners.filter((l) => l !== cb);
      }
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Platform, 'OS', originalDescriptor);
    }
  });

  function dispatchKey(key: string, target?: Partial<HTMLElement>) {
    let prevented = false;
    const event = {
      key,
      target: target ?? { tagName: 'DIV' },
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      get defaultPrevented() {
        return prevented;
      },
      preventDefault() {
        prevented = true;
      },
    } as unknown as KeyboardEvent;
    for (const listener of [...listeners]) {
      listener(event);
    }
    return event;
  }

  it('fires on the bound key on web and calls preventDefault', async () => {
    const handler = jest.fn();
    await render(React.createElement(ShortcutHarness, { shortcutKey: 'Enter', onTrigger: handler }));

    const ev = dispatchKey('Enter', { tagName: 'DIV' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('ignores events while INPUT, TEXTAREA, or contenteditable element is focused', async () => {
    const handler = jest.fn();
    await render(React.createElement(ShortcutHarness, { shortcutKey: '/', onTrigger: handler }));

    dispatchKey('/', { tagName: 'INPUT' });
    dispatchKey('/', { tagName: 'TEXTAREA' });
    dispatchKey('/', { tagName: 'DIV', isContentEditable: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('respects enabled: false', async () => {
    const handler = jest.fn();
    await render(
      React.createElement(ShortcutHarness, {
        shortcutKey: ' ',
        onTrigger: handler,
        enabled: false,
      }),
    );

    dispatchKey(' ', { tagName: 'DIV' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('is a no-op when Platform.OS !== web', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });
    const handler = jest.fn();
    await render(React.createElement(ShortcutHarness, { shortcutKey: 'Enter', onTrigger: handler }));

    dispatchKey('Enter', { tagName: 'DIV' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    const handler = jest.fn();
    const { unmount } = await render(
      React.createElement(ShortcutHarness, { shortcutKey: '1', onTrigger: handler }),
    );

    await act(async () => {
      await unmount();
    });
    dispatchKey('1', { tagName: 'DIV' });
    expect(handler).not.toHaveBeenCalled();
  });
});
