import React, { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeckFormModal } from './DeckFormModal';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      <AppLanguageProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>
  );
}

function pressByText(text: string) {
  const elements = screen.getAllByText(text);
  fireEvent.press(elements[elements.length - 1]);
}

const deck = {
  id: 'd2',
  name: 'Verbs',
  target_language: 'en',
  is_default: false,
  item_count: 0,
  user_id: 'u1',
  created_at: '',
  updated_at: '',
};

describe('DeckFormModal', () => {
  it('submits trimmed name in create mode', async () => {
    const onSubmit = jest.fn();
    await render(<DeckFormModal visible mode="create" onClose={jest.fn()} onSubmit={onSubmit} />, {
      wrapper: Wrapper,
    });

    fireEvent.changeText(screen.getByPlaceholderText('Deck name'), '  Nouns  ');
    await waitFor(() => expect(screen.getByDisplayValue('  Nouns  ')).toBeTruthy());
    pressByText('New deck');

    expect(onSubmit).toHaveBeenCalledWith('Nouns');
  });

  it('shows validation error for empty name', async () => {
    const onSubmit = jest.fn();
    await render(<DeckFormModal visible mode="create" onClose={jest.fn()} onSubmit={onSubmit} />, {
      wrapper: Wrapper,
    });

    const submitButtons = screen.getAllByText('New deck');
    expect(submitButtons[submitButtons.length - 1]).toBeDisabled();
    fireEvent(screen.getByPlaceholderText('Deck name'), 'submitEditing');

    await waitFor(() => expect(screen.getByText('Please enter a deck name.')).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prefills name in rename mode', async () => {
    await render(<DeckFormModal visible mode="rename" deck={deck} onClose={jest.fn()} onSubmit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByDisplayValue('Verbs')).toBeTruthy();
  });

  it('confirms then calls onDelete', async () => {
    const onDelete = jest.fn();
    await render(
      <DeckFormModal
        visible
        mode="rename"
        deck={deck}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        onDelete={onDelete}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.press(screen.getByText('Delete deck'));
    await waitFor(() => expect(screen.getByText('Delete')).toBeTruthy());

    fireEvent.press(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });
});
