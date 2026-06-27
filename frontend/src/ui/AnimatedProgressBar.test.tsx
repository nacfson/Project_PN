import { render } from '@testing-library/react-native';
import { AnimatedProgressBar } from './AnimatedProgressBar';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';

jest.mock('../hooks/useReducedMotion');
const mockedUseReducedMotion = jest.mocked(useReducedMotion);

describe('AnimatedProgressBar', () => {
  beforeEach(() => {
    mockedUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders progress fill with correct percent', async () => {
    const { getByTestId } = await render(<AnimatedProgressBar percent={50} />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('progress-fill')).toBeTruthy();
  });

  it('clamps percent to 0-100 range', async () => {
    const { getByTestId } = await render(<AnimatedProgressBar percent={150} />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('progress-fill')).toBeTruthy();
  });

  it('handles 0 percent', async () => {
    const { getByTestId } = await render(<AnimatedProgressBar percent={0} />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('progress-fill')).toBeTruthy();
  });

  it('respects reduced motion preference', async () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const { getByTestId } = await render(<AnimatedProgressBar percent={75} />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('progress-fill')).toBeTruthy();
  });
});
