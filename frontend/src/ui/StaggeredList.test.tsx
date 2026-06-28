import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { StaggeredList } from './StaggeredList';
import { useReducedMotion } from '../hooks/useReducedMotion';

jest.mock('../hooks/useReducedMotion');

const mockedUseReducedMotion = jest.mocked(useReducedMotion);

describe('StaggeredList', () => {
  beforeEach(() => {
    mockedUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders children', async () => {
    const { getByText } = await render(
      <StaggeredList>
        <Text>First</Text>
        <Text>Second</Text>
      </StaggeredList>
    );
    expect(getByText('First')).toBeTruthy();
    expect(getByText('Second')).toBeTruthy();
  });

  it('renders children when reduced motion is enabled', async () => {
    mockedUseReducedMotion.mockReturnValue(true);

    const { getByText } = await render(
      <StaggeredList>
        <Text>First</Text>
        <Text>Second</Text>
      </StaggeredList>
    );

    expect(getByText('First')).toBeTruthy();
    expect(getByText('Second')).toBeTruthy();
  });
});
