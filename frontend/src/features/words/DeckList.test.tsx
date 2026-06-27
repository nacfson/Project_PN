import React, { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DeckList } from './DeckList';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

const decks = [
  {
    id: 'd1',
    name: 'Default',
    target_language: 'en',
    is_default: true,
    item_count: 3,
    user_id: 'u1',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'd2',
    name: 'Verbs',
    target_language: 'en',
    is_default: false,
    item_count: 5,
    user_id: 'u1',
    created_at: '',
    updated_at: '',
  },
];

describe('DeckList', () => {
  it('renders all-decks chip, deck chips, and create chip', async () => {
    await render(<DeckList decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={jest.fn()} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('All decks (8)')).toBeTruthy();
    expect(screen.getByText('Default (3)')).toBeTruthy();
    expect(screen.getByText('Verbs (5)')).toBeTruthy();
    expect(screen.getByText('New deck')).toBeTruthy();
  });

  it('calls onSelect when a deck chip is pressed', async () => {
    const onSelect = jest.fn();
    await render(<DeckList decks={decks} selectedId={null} onSelect={onSelect} onCreate={jest.fn()} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getByText('Verbs (5)'));
    expect(onSelect).toHaveBeenCalledWith('d2');
  });

  it('calls onSelect with null when all-decks chip is pressed', async () => {
    const onSelect = jest.fn();
    await render(<DeckList decks={decks} selectedId="d2" onSelect={onSelect} onCreate={jest.fn()} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getByText('All decks (8)'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onCreate when create chip is pressed', async () => {
    const onCreate = jest.fn();
    await render(<DeckList decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={onCreate} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getByText('New deck'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('calls onEdit when a deck edit icon is pressed', async () => {
    const onEdit = jest.fn();
    await render(<DeckList decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={jest.fn()} onEdit={onEdit} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getAllByLabelText('Rename deck')[0]);
    expect(onEdit).toHaveBeenCalledWith(decks[0]);
  });
});
