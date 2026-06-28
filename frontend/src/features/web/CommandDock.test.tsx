import { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { CommandDock } from './CommandDock';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

const mockNavigate = jest.fn();
let mockPendingCount = 0;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../hooks/useAddQueue', () => ({
  useAddQueue: () => ({ pendingCount: mockPendingCount }),
}));

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

// Note: Platform.OS is a value property (not a getter) in the jest-expo RN mock.
// We use Object.defineProperty to safely override and restore it per test.

describe('CommandDock', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });
    mockNavigate.mockClear();
    mockPendingCount = 0;
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Platform, 'OS', originalDescriptor);
    }
  });

  it('renders collapsed dock with only the first item', async () => {
    await render(<CommandDock />, { wrapper: Wrapper });
    // Collapsed: only the first item (add) is rendered
    expect(screen.getByTestId('dock-add')).toBeTruthy();
    expect(screen.queryByTestId('dock-practice')).toBeNull();
  });

  it('navigates to Add screen on press', async () => {
    await render(<CommandDock />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByTestId('dock-add'));
    expect(mockNavigate).toHaveBeenCalledWith('Add');
  });

  it('navigates to Practice screen on press', async () => {
    await render(<CommandDock />, { wrapper: Wrapper });
    // Simulate expansion to reveal other items
    await fireEvent(screen.getByTestId('dock-add'), 'hoverIn');
    await fireEvent.press(screen.getByTestId('dock-practice'));
    expect(mockNavigate).toHaveBeenCalledWith('Practice');
  });

  it('navigates to Words (Search) screen on press', async () => {
    await render(<CommandDock />, { wrapper: Wrapper });
    await fireEvent(screen.getByTestId('dock-add'), 'hoverIn');
    await fireEvent.press(screen.getByTestId('dock-search'));
    expect(mockNavigate).toHaveBeenCalledWith('Words');
  });

  it('toggles theme on Theme button press', async () => {
    await render(<CommandDock />, { wrapper: Wrapper });
    await fireEvent(screen.getByTestId('dock-add'), 'hoverIn');
    await fireEvent.press(screen.getByTestId('dock-theme'));
    // ThemeProvider defaults to light mode, so toggling is a local state change;
    // no navigation call is made
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows pending count badge when pendingCount > 0', async () => {
    mockPendingCount = 3;

    await render(<CommandDock />, { wrapper: Wrapper });

    // Expand to show labels
    await fireEvent(screen.getByTestId('dock-add'), 'hoverIn');
    expect(screen.getByText(/3/)).toBeTruthy();
  });
});
