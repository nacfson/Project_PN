import { distanceFromListBottom, readScrollMetrics } from './scrollPagination';

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

describe('readScrollMetrics', () => {
  it('reads metrics from a standard scroll event', () => {
    expect(
      readScrollMetrics({
        contentOffset: { y: 100 },
        contentSize: { height: 1200 },
        layoutMeasurement: { height: 600 },
      }),
    ).toEqual({
      contentHeight: 1200,
      viewportHeight: 600,
      offsetY: 100,
    });
  });

  it('falls back to tracked dimensions when the event is partial', () => {
    expect(
      readScrollMetrics(
        { contentOffset: { y: 50 } },
        { contentHeight: 900, viewportHeight: 400 },
      ),
    ).toEqual({
      contentHeight: 900,
      viewportHeight: 400,
      offsetY: 50,
    });
  });
});
