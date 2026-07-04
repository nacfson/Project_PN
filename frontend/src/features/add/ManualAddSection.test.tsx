import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AddQueueProvider } from '../../hooks/useAddQueue';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ManualAddSection } from './ManualAddSection';

jest.mock('../../api/words', () => ({
  addLearningItem: jest.fn().mockResolvedValue(undefined),
  lookupWord: jest.fn().mockResolvedValue({ sense_options: [] }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>
        <AddQueueProvider>{children}</AddQueueProvider>
      </ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('ManualAddSection', () => {
  it('disables add when input is empty', async () => {
    await render(<ManualAddSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    const addButton = screen.getByText('Add Word');
    expect(addButton).toBeDisabled();
  });

  it('wraps the input in a flex container that can shrink so the add button is not pushed out of bounds', async () => {
    await render(<ManualAddSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    const inputWrapper = screen.getByTestId('manual-add-input-wrapper');
    expect(inputWrapper).toHaveStyle({ flex: 1, minWidth: 0 });
  });

  it('enqueues a word with the selected deck', async () => {
    await render(<ManualAddSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByPlaceholderText('Type a word'), 'hello');
    fireEvent.press(screen.getByText('Add Word'));

    expect(screen.getByPlaceholderText('Type a word').props.value).toBe('');
  });

  it('validates fields on blur', async () => {
    await render(<ManualAddSection selectedDeckId="deck-123" targetLanguage="en" />, { wrapper: Wrapper });

    const input = screen.getByPlaceholderText('Type a word');
    
    // Type numbers (invalid word)
    fireEvent.changeText(input, 'hello123');
    
    // Wait for text to settle in the input field
    await waitFor(() => {
      expect(input.props.value).toBe('hello123');
    });

    // Now trigger blur
    fireEvent(input, 'blur');

    // Should display validation error text
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid word.')).toBeTruthy();
    });
  });
});
