import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.join(process.cwd(), '.env'));

const isDev = process.argv.includes('--dev');

async function build() {
  await esbuild.build({
    entryPoints: {
      background: 'src/background.ts',
      content: 'src/content.ts',
      popup: 'src/popup/popup.ts',
    },
    bundle: true,
    outdir: 'dist',
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    sourcemap: isDev,
    minify: !isDev,
    define: {
      'process.env.EXT_API_BASE_URL': JSON.stringify(process.env.EXT_API_BASE_URL ?? 'http://localhost:8080'),
    },
  });

  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const devKey = process.env.PN_DEV_EXTENSION_KEY;
  if (isDev && devKey) {
    manifest.key = devKey;
  }
  fs.writeFileSync(path.join('dist', 'manifest.json'), JSON.stringify(manifest, null, 2));

  fs.copyFileSync('src/popup/popup.html', path.join('dist', 'popup.html'));
  fs.copyFileSync('src/popup/popup.css', path.join('dist', 'popup.css'));
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
