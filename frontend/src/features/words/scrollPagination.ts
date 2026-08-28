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
