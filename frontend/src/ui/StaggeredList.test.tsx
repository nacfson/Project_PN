import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { StaggeredList } from './StaggeredList';

describe('StaggeredList', () => {
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
});
