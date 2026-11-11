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

  it('defaults scrollEnabled to true without title and does not clamp maxWidth on scroll container', async () => {
    const { getByTestId } = await render(
      <Screen testID="screen-scroll">
        <Text>Scrollable</Text>
      </Screen>,
      { wrapper: ThemeProvider },
    );
    const scrollContainer = getByTestId('screen-scroll');
    expect(scrollContainer.props.scrollEnabled).toBe(true);
    const flatStyle = Array.isArray(scrollContainer.props.style)
      ? Object.assign({}, ...scrollContainer.props.style.filter(Boolean))
      : scrollContainer.props.style;
    expect(flatStyle?.maxWidth).toBeUndefined();
  });

  it('renders a bounded container when scrollEnabled is false without title', async () => {
    const { getByTestId } = await render(
      <Screen scrollEnabled={false} testID="screen-bounded">
        <Text>Bounded</Text>
      </Screen>,
      { wrapper: ThemeProvider },
    );
    const container = getByTestId('screen-bounded');
    // Bounded view is a plain View with flex: 1, not a ScrollView with contentContainerStyle
    expect(container.props.contentContainerStyle).toBeUndefined();
    expect(container.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flex: 1, width: '100%' })]),
    );
  });
});
