import { render, fireEvent } from '@testing-library/react-native';
import { Chip } from './Chip';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('Chip', () => {
  it('renders label correctly', async () => {
    const { getByText } = await render(<Chip label="Test Label" />, {
      wrapper: ThemeProvider,
    });
    expect(getByText('Test Label')).toBeTruthy();
  });

  it('renders selected state correctly', async () => {
    const { getByText } = await render(<Chip label="Selected Label" selected />, {
      wrapper: ThemeProvider,
    });
    expect(getByText('Selected Label')).toBeTruthy();
  });

  it('fires onPress event', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Chip label="Click Me" onPress={onPress} />, {
      wrapper: ThemeProvider,
    });
    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalled();
  });
});
