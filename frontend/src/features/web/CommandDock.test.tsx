import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { CommandDock } from './CommandDock';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../hooks/useAddQueue', () => ({
  useAddQueue: () => ({ pendingCount: 0 }),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'web';
  return RN;
});

describe('CommandDock', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders collapsed dock with only the first item', async () => {
    await render(
      <ThemeProvider>
        <CommandDock />
      </ThemeProvider>
    );
    // Collapsed: only the first item (add) is rendered
    expect(screen.getByTestId('dock-add')).toBeTruthy();
    expect(screen.queryByTestId('dock-practice')).toBeNull();
  });

  it('navigates to Add screen on press', async () => {
    await render(
      <ThemeProvider>
        <CommandDock />
      </ThemeProvider>
    );
    fireEvent.press(screen.getByTestId('dock-add'));
    expect(mockNavigate).toHaveBeenCalledWith('Add');
  });
});
