export function distanceFromListBottom(
  contentHeight: number,
  viewportHeight: number,
  offsetY: number,
): number | null {
  if (contentHeight <= 0 || viewportHeight <= 0) {
    return null;
  }
  return contentHeight - viewportHeight - offsetY;
}

export type ScrollMetrics = {
  contentHeight: number;
  viewportHeight: number;
  offsetY: number;
};

/** Read scroll metrics from RN or Reanimated scroll events, with optional fallbacks. */
export function readScrollMetrics(
  nativeEvent: {
    contentOffset?: { y?: number };
    contentSize?: { height?: number };
    layoutMeasurement?: { height?: number };
  } | null | undefined,
  fallbacks?: { contentHeight?: number; viewportHeight?: number },
): ScrollMetrics | null {
  const offsetY = nativeEvent?.contentOffset?.y ?? 0;
  const contentHeight = nativeEvent?.contentSize?.height ?? fallbacks?.contentHeight ?? 0;
  const viewportHeight = nativeEvent?.layoutMeasurement?.height ?? fallbacks?.viewportHeight ?? 0;

  if (contentHeight <= 0 || viewportHeight <= 0) {
    return null;
  }

  return { contentHeight, viewportHeight, offsetY };
}
