import { colorsFor, typography, shadows } from './tokens';

describe('Theme Tokens Upgrade', () => {
  it('should contain the new blue-indigo primary brand color', () => {
    const lightColors = colorsFor('light');
    expect(lightColors.primary).toBe('#4F6AFF');
    expect(lightColors.surfaceGlass).toBe('rgba(255, 255, 255, 0.72)');
  });

  it('should contain dark mode blue-indigo primary', () => {
    const darkColors = colorsFor('dark');
    expect(darkColors.primary).toBe('#7B93FF');
    expect(darkColors.surfaceGlass).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('should use Inter font family', () => {
    expect(typography.fontFamily).toBe('Inter-Regular');
  });

  it('should have updated typography sizes', () => {
    expect(typography.sizes.lg).toBe(17);
    expect(typography.sizes.xl).toBe(21);
    expect(typography.sizes.xxxl).toBe(34);
  });

  it('should have color-tinted shadows in light mode', () => {
    expect(shadows.md.shadowColor).toContain('79');
    expect(shadows.sm.shadowColor).toBe('rgba(79, 106, 255, 0.04)');
    expect(shadows.md.shadowColor).toBe('rgba(79, 106, 255, 0.06)');
    expect(shadows.lg.shadowColor).toBe('rgba(79, 106, 255, 0.1)');
  });

  it('should have updated shadow offsets', () => {
    expect(shadows.sm.shadowOffset).toEqual({ width: 0, height: 2 });
    expect(shadows.md.shadowOffset).toEqual({ width: 0, height: 8 });
    expect(shadows.lg.shadowOffset).toEqual({ width: 0, height: 16 });
  });

  it('should have borderGlass tokens', () => {
    const lightColors = colorsFor('light');
    const darkColors = colorsFor('dark');
    expect(lightColors.borderGlass).toBe('rgba(255, 255, 255, 0.5)');
    expect(darkColors.borderGlass).toBe('rgba(255, 255, 255, 0.08)');
  });

  it('should have updated light mode accent and secondary colors', () => {
    const lightColors = colorsFor('light');
    expect(lightColors.secondary).toBe('#5B6B8A');
    expect(lightColors.tertiary).toBe('#E87C4F');
    expect(lightColors.accent).toBe('#00B4A0');
    expect(lightColors.background).toBe('#F5F7FC');
    expect(lightColors.surface).toBe('#FFFFFF');
    expect(lightColors.outlineVariant).toBe('#C8CDD8');
  });

  it('should have updated dark mode accent and secondary colors', () => {
    const darkColors = colorsFor('dark');
    expect(darkColors.secondary).toBe('#A8B8D8');
    expect(darkColors.tertiary).toBe('#FFB088');
    expect(darkColors.accent).toBe('#4EDDC8');
    expect(darkColors.background).toBe('#0A0E1A');
    expect(darkColors.surface).toBe('#141827');
    expect(darkColors.outlineVariant).toBe('#2A3048');
  });
});
