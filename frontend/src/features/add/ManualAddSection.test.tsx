import React, { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
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
    await render(<ManualAddSection selectedDeckId="deck-123" />, { wrapper: Wrapper });

    const addButton = screen.getByText('Add Word');
    expect(addButton).toBeDisabled();
  });

  it('enqueues a word with the selected deck', async () => {
    await render(<ManualAddSection selectedDeckId="deck-123" />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByPlaceholderText('Type a word'), 'hello');
    fireEvent.press(screen.getByText('Add Word'));

    expect(screen.getByPlaceholderText('Type a word').props.value).toBe('');
  });
});
