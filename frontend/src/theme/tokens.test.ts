import { theme, stageColor } from './tokens';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design Tokens Contract', () => {
  const { colors, stage, layout } = theme;

  describe('WCAG contrast thresholds (research R11)', () => {
    const textPairs: Array<[string, string, string, number]> = [
      ['text on canvas', colors.text, colors.canvas, 4.5],
      ['text on surface', colors.text, colors.surface, 4.5],
      ['textSecondary on surface', colors.textSecondary, colors.surface, 4.5],
      ['textMuted on canvas', colors.textMuted, colors.canvas, 4.5],
      ['textMuted on surface', colors.textMuted, colors.surface, 4.5],
      ['textMuted on fill', colors.textMuted, colors.fill, 4.5],
      ['accent on canvas', colors.accent, colors.canvas, 4.5],
      ['accent on surface', colors.accent, colors.surface, 4.5],
      ['onPrimary on primary', colors.onPrimary, colors.primary, 4.5],
      ['onPrimary on primaryHover', colors.onPrimary, colors.primaryHover, 4.5],
      ['danger on surface', colors.danger, colors.surface, 4.5],
      ['success on surface', colors.success, colors.surface, 4.5],
      ['warning on surface', colors.warning, colors.surface, 4.5],
    ];

    it.each(textPairs)('%s meets >= %d:1 contrast', (_name, fg, bg, minRatio) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minRatio);
    });

    const boundaryPairs: Array<[string, string, string, number]> = [
      ['controlBorderStrong on surface', colors.controlBorderStrong, colors.surface, 3.0],
      ['controlBorderStrong on canvas', colors.controlBorderStrong, colors.canvas, 3.0],
      ['accent on surface', colors.accent, colors.surface, 3.0],
      ['accent on canvas', colors.accent, colors.canvas, 3.0],
      ['focusRing on surface', colors.focusRing, colors.surface, 3.0],
      ['focusRing on canvas', colors.focusRing, colors.canvas, 3.0],
    ];

    it.each(boundaryPairs)('%s meets >= %d:1 UI boundary contrast', (_name, fg, bg, minRatio) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minRatio);
    });
  });

  describe('Stage ramp', () => {
    it('has the exact 6 learning stage keys', () => {
      expect(Object.keys(stage)).toEqual([
        'new',
        'learning',
        'recognized',
        'recalled',
        'usable',
        'mastered',
      ]);
    });

    it('returns the matching stage color and falls back to new for unknown keys', () => {
      expect(stageColor('mastered')).toBe(stage.mastered);
      expect(stageColor('unknown')).toBe(stage.new);
      expect(stageColor('')).toBe(stage.new);
    });
  });

  describe('Layout tokens', () => {
    it('defines sidebarMinPageWidth = 720 and contentMaxWidth = 760', () => {
      expect(layout.sidebarMinPageWidth).toBe(720);
      expect(layout.contentMaxWidth).toBe(760);
      expect(layout.sidebarWidth).toBe(232);
    });
  });
});
