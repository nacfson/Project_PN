import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { HoverReveal } from './HoverReveal';

describe('HoverReveal', () => {
  it('renders children', async () => {
    await render(
      <HoverReveal>
        <Text>Hidden action</Text>
      </HoverReveal>
    );
    expect(screen.getByText('Hidden action')).toBeTruthy();
  });
});
