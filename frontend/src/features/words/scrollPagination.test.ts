import { distanceFromListBottom } from './scrollPagination';

describe('distanceFromListBottom', () => {
  it('returns distance using tracked viewport and content heights', () => {
    expect(distanceFromListBottom(1200, 600, 500)).toBe(100);
  });

  it('returns zero when scrolled to the bottom', () => {
    expect(distanceFromListBottom(1200, 600, 600)).toBe(0);
  });

  it('returns null when dimensions are not ready', () => {
    expect(distanceFromListBottom(0, 600, 0)).toBeNull();
    expect(distanceFromListBottom(1200, 0, 0)).toBeNull();
  });
});
