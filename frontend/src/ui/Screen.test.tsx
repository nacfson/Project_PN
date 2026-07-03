import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen } from './Screen';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('Screen', () => {
  it('renders children correctly', async () => {
    await render(
      <Screen>
        <Text>Test Content</Text>
      </Screen>,
      { wrapper: ThemeProvider },
    );
    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('renders title when title prop is provided', async () => {
    await render(
      <Screen title="Test Title">
        <Text>Content</Text>
      </Screen>,
      { wrapper: ThemeProvider },
    );
    const titles = screen.getAllByText('Test Title');
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });
});
