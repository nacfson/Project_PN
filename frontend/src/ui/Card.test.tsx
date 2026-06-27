import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from './Card';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('Card', () => {
  it('renders children', async () => {
    await render(
      <Card>
        <Text>Hello</Text>
      </Card>,
      { wrapper: ThemeProvider },
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress}>
        <Text>Press me</Text>
      </Card>,
      { wrapper: ThemeProvider },
    );
    fireEvent.press(screen.getByText('Press me'));
    expect(onPress).toHaveBeenCalled();
  });
});
