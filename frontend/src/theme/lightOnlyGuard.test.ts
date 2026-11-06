import fs from 'fs';
import path from 'path';

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Light-only static guard (SC-011)', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const thisFile = path.resolve(__dirname, 'lightOnlyGuard.test.ts');

  const FORBIDDEN_PATTERNS = [
    /\bmd3Dark\b/,
    /\bbento(Indigo|Sunset|Light)?\b/i,
    /\btoggleMode\b/,
    /\bsetMode\s*\(/,
    /\bThemeVariation\b/,
    /\bthemeModeStorage\b/,
    /\bthemeVariationStorage\b/,
    /\bvisualVariations\b/,
  ];

  it('contains no dark-mode or theme-variation symbols across frontend/src', () => {
    const files = collectSourceFiles(srcRoot).filter((f) => path.resolve(f) !== thisFile);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          const rel = path.relative(srcRoot, file);
          violations.push(`${rel} matched ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('contains no raw #hex or rgba( literals outside theme, Confetti, and tests (SC-008)', () => {
    const themeDir = path.resolve(srcRoot, 'theme');
    const confettiFile = path.resolve(srcRoot, 'components', 'Confetti.tsx');
    const files = collectSourceFiles(srcRoot).filter((f) => {
      const resolved = path.resolve(f);
      if (resolved.startsWith(themeDir + path.sep)) return false;
      if (resolved === confettiFile) return false;
      if (/\.test\.(ts|tsx)$/.test(resolved)) return false;
      return true;
    });

    const RAW_COLOR_PATTERNS = [/#[0-9a-fA-F]{3,8}\b/, /\brgba\s*\(/];
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of RAW_COLOR_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
          const rel = path.relative(srcRoot, file);
          violations.push(`${rel} matched ${match[0]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('contains no references to removed legacy color aliases (SC-008)', () => {
    const files = collectSourceFiles(srcRoot).filter(
      (f) => path.resolve(f) !== thisFile && !/\.test\.(ts|tsx)$/.test(f),
    );
    const LEGACY_ALIAS_PATTERN =
      /\b(surfaceContainer|surfaceContainerLow|surfaceContainerHigh|surfaceContainerHighest|surfaceContainerLowest|onSurface|onSurfaceVariant|outlineVariant|primaryContainer|secondaryContainer|tertiaryContainer|errorContainer|inverseSurface|inverseOnSurface|accent2|surfaceGlass|borderGlass)\b/;

    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const match = content.match(LEGACY_ALIAS_PATTERN);
      if (match) {
        const rel = path.relative(srcRoot, file);
        violations.push(`${rel} matched ${match[0]}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
