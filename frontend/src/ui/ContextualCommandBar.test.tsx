import { ReactNode } from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ContextualCommandBar } from './ContextualCommandBar';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('ContextualCommandBar', () => {
  it('renders actions and calls onClear', async () => {
    const onClear = jest.fn();
    const onRename = jest.fn();
    const screen = await render(
      <ContextualCommandBar
        selectedCount={2}
        onClear={onClear}
        actions={[{ id: 'rename', label: 'Rename', icon: 'create-outline', onPress: onRename }]}
      />,
      { wrapper: Wrapper },
    );
    const renameButton = screen.getByText('Rename');
    await act(async () => {
      fireEvent.press(renameButton);
    });
    expect(onRename).toHaveBeenCalled();
    const clearButton = screen.getByTestId('command-bar-clear');
    await act(async () => {
      fireEvent.press(clearButton);
    });
    expect(onClear).toHaveBeenCalled();
  });

  it('renders null when selectedCount is 0', async () => {
    const screen = await render(
      <ContextualCommandBar selectedCount={0} onClear={jest.fn()} actions={[]} />,
      { wrapper: Wrapper },
    );
    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it('renders disabled action without calling onPress', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <ContextualCommandBar
        selectedCount={1}
        onClear={jest.fn()}
        actions={[{ id: 'del', label: 'Delete', icon: 'trash-outline', onPress, disabled: true }]}
      />,
      { wrapper: Wrapper },
    );
    const deleteButton = screen.getByText('Delete');
    await act(async () => {
      fireEvent.press(deleteButton);
    });
    expect(onPress).not.toHaveBeenCalled();
  });
});
