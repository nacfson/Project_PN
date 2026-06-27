import { render } from '@testing-library/react-native';
import { SkeletonCard } from './SkeletonCard';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';

jest.mock('../hooks/useReducedMotion');
const mockedUseReducedMotion = jest.mocked(useReducedMotion);

describe('SkeletonCard', () => {
  beforeEach(() => {
    mockedUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the requested number of lines', async () => {
    const { getAllByTestId } = await render(<SkeletonCard lines={3} />, {
      wrapper: ThemeProvider,
    });
    expect(getAllByTestId('skeleton-line')).toHaveLength(3);
  });
});
