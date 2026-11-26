import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export const DEFAULT_PATHS = {
  csvDir: path.join(REPO_ROOT, 'frontend', 'src', 'i18n', 'csv'),
  translationsPath: path.join(REPO_ROOT, 'frontend', 'src', 'i18n', 'translations.ts'),
  exportPath: path.join(REPO_ROOT, 'frontend', 'src', 'i18n', 'translations.export.csv'),
};

export const CSV_HEADER = ['key', 'en', 'ko'];
export const PREFIX_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
export const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z0-9_-]+)+$/;
// Matches AppLanguageProvider.tsx interpolate() placeholder regex exactly.
export const PLACEHOLDER_RE = /\{(\w+)\}/g;

// Known language-grammar exception documented in frontend/docs/ui-translation-audit-report.md.
export const PLACEHOLDER_ALLOWLIST = new Map([
  ['queue.adding', { koOmitted: new Set(['plural']) }],
]);

export function compareAscii(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseCsv(rawText, sourceLabel = '<csv>') {
  if (typeof rawText !== 'string') {
    throw new Error(`${sourceLabel}: CSV input must be a string.`);
  }
  const text = rawText.startsWith('\uFEFF') ? rawText.slice(1) : rawText;
  if (text.length === 0) {
    throw new Error(`${sourceLabel}: CSV file is empty.`);
  }

  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let fieldStart = true;
  let justClosedQuote = false;
  let line = 1;
  let recordStartLine = 1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else if (ch === '\r') {
        if (text[i + 1] === '\n') {
          i += 1;
        }
        field += '\n';
        line += 1;
      } else if (ch === '\n') {
        field += '\n';
        line += 1;
      } else {
        field += ch;
      }
      continue;
    }

    if (justClosedQuote) {
      if (ch === ',') {
        row.push(field);
        field = '';
        fieldStart = true;
        justClosedQuote = false;
        continue;
      }
      if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text[i + 1] === '\n') {
          i += 1;
        }
        row.push(field);
        records.push({ fields: row, line: recordStartLine });
        row = [];
        field = '';
        fieldStart = true;
        justClosedQuote = false;
        line += 1;
        recordStartLine = line;
        continue;
      }
      throw new Error(
        `${sourceLabel}:${line}: unexpected character ${JSON.stringify(ch)} after closing quote.`,
      );
    }

    if (fieldStart && ch === '"') {
      inQuotes = true;
      fieldStart = false;
      continue;
    }

    if (ch === '"') {
      throw new Error(`${sourceLabel}:${line}: unescaped quote inside unquoted field.`);
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      fieldStart = true;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      records.push({ fields: row, line: recordStartLine });
      row = [];
      field = '';
      fieldStart = true;
      line += 1;
      recordStartLine = line;
      continue;
    }

    field += ch;
    fieldStart = false;
  }

  if (inQuotes) {
    throw new Error(`${sourceLabel}:${recordStartLine}: unclosed quoted field at end of file.`);
  }

  if (!fieldStart || row.length > 0 || justClosedQuote) {
    row.push(field);
    records.push({ fields: row, line: recordStartLine });
  }

  if (records.length === 0) {
    throw new Error(`${sourceLabel}: CSV file contains no records.`);
  }

  const header = records[0].fields;
  if (
    header.length !== CSV_HEADER.length ||
    header.some((col, index) => col !== CSV_HEADER[index])
  ) {
    throw new Error(
      `${sourceLabel}:1: invalid CSV header ${JSON.stringify(header.join(','))}; expected "${CSV_HEADER.join(',')}".`,
    );
  }

  const rows = [];
  for (let idx = 1; idx < records.length; idx += 1) {
    const rec = records[idx];
    if (rec.fields.length === 1 && rec.fields[0] === '') {
      throw new Error(`${sourceLabel}:${rec.line}: blank line is not allowed in CSV.`);
    }
    if (rec.fields.length !== CSV_HEADER.length) {
      throw new Error(
        `${sourceLabel}:${rec.line}: expected ${CSV_HEADER.length} columns (${CSV_HEADER.join(',')}), got ${rec.fields.length}.`,
      );
    }
    rows.push({
      key: rec.fields[0],
      en: rec.fields[1],
      ko: rec.fields[2],
      line: rec.line,
      source: sourceLabel,
    });
  }

  return rows;
}

export function escapeCsvField(rawValue) {
  const value = normalizeLineEndings(String(rawValue));
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCsv(rows, { bom = false } = {}) {
  const lines = [CSV_HEADER.join(',')];
  for (const row of rows) {
    lines.push(
      `${escapeCsvField(row.key)},${escapeCsvField(row.en)},${escapeCsvField(row.ko)}`,
    );
  }
  return `${bom ? '\uFEFF' : ''}${lines.join('\n')}\n`;
}

export function extractPlaceholders(text) {
  const names = new Set();
  for (const match of text.matchAll(new RegExp(PLACEHOLDER_RE.source, 'g'))) {
    names.add(match[1]);
  }
  return names;
}

export function validateKey(key, source = '<csv>', line = 0) {
  const loc = line > 0 ? `${source}:${line}` : source;
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`${loc}: translation key must not be empty.`);
  }
  if (key !== key.trim()) {
    throw new Error(`${loc}: translation key ${JSON.stringify(key)} has leading or trailing whitespace.`);
  }
  if (!KEY_RE.test(key)) {
    throw new Error(
      `${loc}: invalid translation key ${JSON.stringify(key)}. Keys must match <prefix>.<segment>[.<segment>...] using ASCII letters, digits, "_" or "-".`,
    );
  }
  return key.split('.')[0];
}

export function resolvePrefixCsvPath(csvDir, prefix) {
  if (!PREFIX_RE.test(prefix)) {
    throw new Error(`Invalid CSV prefix ${JSON.stringify(prefix)}.`);
  }
  const resolvedDir = path.resolve(csvDir);
  const fileName = `${prefix}.csv`;
  const resolvedPath = path.resolve(resolvedDir, fileName);
  if (path.dirname(resolvedPath) !== resolvedDir || path.basename(resolvedPath) !== fileName) {
    throw new Error(`Resolved CSV path escapes target directory for prefix ${JSON.stringify(prefix)}.`);
  }
  return resolvedPath;
}

export function validatePlaceholderParity(key, en, ko, source = '<csv>', line = 0) {
  const loc = line > 0 ? `${source}:${line}` : source;
  const enPlaceholders = extractPlaceholders(en);
  const koPlaceholders = extractPlaceholders(ko);
  const allowlist = PLACEHOLDER_ALLOWLIST.get(key);

  const extraInKo = [...koPlaceholders].filter((name) => !enPlaceholders.has(name)).sort(compareAscii);
  if (extraInKo.length > 0) {
    throw new Error(
      `${loc}: key ${JSON.stringify(key)} has placeholder(s) in ko missing from en: ${extraInKo.join(', ')}.`,
    );
  }

  const missingInKo = [...enPlaceholders]
    .filter((name) => !koPlaceholders.has(name) && !allowlist?.koOmitted.has(name))
    .sort(compareAscii);
  if (missingInKo.length > 0) {
    throw new Error(
      `${loc}: key ${JSON.stringify(key)} is missing placeholder(s) in ko: ${missingInKo.join(', ')}.`,
    );
  }
}

export function validateRows(rows, { expectedPrefix, csvDir, sourceLabel = '<csv>' } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${sourceLabel}: translation dataset must contain at least one row.`);
  }

  const seenKeys = new Map();
  const prefixByLower = new Map();

  for (const row of rows) {
    const source = row.source ?? sourceLabel;
    const line = row.line ?? 0;
    const loc = line > 0 ? `${source}:${line}` : source;

    const prefix = validateKey(row.key, source, line);

    if (expectedPrefix !== undefined && prefix !== expectedPrefix) {
      throw new Error(
        `${loc}: key ${JSON.stringify(row.key)} belongs to prefix ${JSON.stringify(prefix)}, not ${JSON.stringify(expectedPrefix)}.csv.`,
      );
    }

    const lowerPrefix = prefix.toLowerCase();
    const existingPrefix = prefixByLower.get(lowerPrefix);
    if (existingPrefix && existingPrefix !== prefix) {
      throw new Error(
        `${loc}: case-colliding prefix ${JSON.stringify(prefix)} conflicts with ${JSON.stringify(existingPrefix)}.`,
      );
    }
    prefixByLower.set(lowerPrefix, prefix);

    if (csvDir) {
      resolvePrefixCsvPath(csvDir, prefix);
    }

    if (seenKeys.has(row.key)) {
      const prev = seenKeys.get(row.key);
      throw new Error(
        `${loc}: duplicate translation key ${JSON.stringify(row.key)} (first seen at ${prev}).`,
      );
    }
    seenKeys.set(row.key, loc);

    if (typeof row.en !== 'string' || row.en.trim() === '') {
      throw new Error(`${loc}: key ${JSON.stringify(row.key)} has empty en value.`);
    }
    if (typeof row.ko !== 'string' || row.ko.trim() === '') {
      throw new Error(`${loc}: key ${JSON.stringify(row.key)} has empty ko value.`);
    }

    validatePlaceholderParity(row.key, row.en, row.ko, source, line);
  }
}

export function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Preserve original write/rename error.
    }
    throw err;
  }
}

export function listCsvFiles(csvDir) {
  if (!fs.existsSync(csvDir)) {
    throw new Error(`CSV directory does not exist: ${csvDir}`);
  }
  const entries = fs.readdirSync(csvDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    if (/\.csv$/i.test(entry.name)) {
      if (!entry.isFile()) {
        throw new Error(
          `CSV entry must be a regular file (symlinks and directories are not allowed): ${JSON.stringify(entry.name)} in ${csvDir}.`,
        );
      }
      if (!entry.name.endsWith('.csv')) {
        throw new Error(
          `CSV filename must use lowercase ".csv" extension: ${JSON.stringify(entry.name)} in ${csvDir}.`,
        );
      }
      files.push(entry.name);
    }
  }
  return files.sort(compareAscii);
}

export function loadDomainCsvs(csvDir) {
  const files = listCsvFiles(csvDir);
  if (files.length === 0) {
    throw new Error(`No .csv files found in ${csvDir}.`);
  }

  const lowerNames = new Map();
  for (const fileName of files) {
    const lower = fileName.toLowerCase();
    if (lowerNames.has(lower)) {
      throw new Error(
        `Case-colliding CSV filenames in ${csvDir}: ${lowerNames.get(lower)} and ${fileName}.`,
      );
    }
    lowerNames.set(lower, fileName);
  }

  const allRows = [];
  for (const fileName of files) {
    const prefix = fileName.slice(0, -'.csv'.length);
    if (!PREFIX_RE.test(prefix)) {
      throw new Error(`Invalid CSV filename ${JSON.stringify(fileName)} in ${csvDir}.`);
    }
    const fullPath = resolvePrefixCsvPath(csvDir, prefix);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const rows = parseCsv(raw, fileName);
    validateRows(rows, { expectedPrefix: prefix, csvDir, sourceLabel: fileName });
    allRows.push(...rows);
  }

  validateRows(allRows, { csvDir, sourceLabel: csvDir });
  return allRows;
}

export function formatTsString(value) {
  const escaped = normalizeLineEndings(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `'${escaped}'`;
}

function renderDictionaryEntries(rows, field) {
  const lines = [];
  let prevPrefix = null;
  for (const row of rows) {
    const prefix = row.key.split('.')[0];
    if (prevPrefix !== null && prefix !== prevPrefix) {
      lines.push('');
    }
    lines.push(`  ${formatTsString(row.key)}: ${formatTsString(row[field])},`);
    prevPrefix = prefix;
  }
  return lines.join('\n');
}

export function generateTranslationsTs(rows) {
  validateRows(rows, { sourceLabel: 'generateTranslationsTs' });
  const header = [
    '// AUTO-GENERATED from frontend/src/i18n/csv/*.csv. Do not edit directly.',
    '// Edit CSV files under frontend/src/i18n/csv/ and run: npm run i18n:sync',
    '',
  ].join('\n');

  const enBlock = `export const en = {\n${renderDictionaryEntries(rows, 'en')}\n} as const;\n`;
  const typeBlock = '\nexport type TranslationKey = keyof typeof en;\n';
  const koBlock = `\nexport const ko: Record<TranslationKey, string> = {\n${renderDictionaryEntries(rows, 'ko')}\n};\n`;

  return `${header}${enBlock}${typeBlock}${koBlock}`;
}

export async function parseTranslationsTs(tsContent, sourceLabel = 'translations.ts') {
  // Dynamically loaded so sync/check/export/import remain zero-dependency Node built-in runs.
  const tsModule = await import('typescript');
  const ts = tsModule.default ?? tsModule;

  const sourceFile = ts.createSourceFile(sourceLabel, tsContent, ts.ScriptTarget.Latest, true);
  if (Array.isArray(sourceFile.parseDiagnostics) && sourceFile.parseDiagnostics.length > 0) {
    const first = sourceFile.parseDiagnostics[0];
    const msg = ts.flattenDiagnosticMessageText(first.messageText, '\n');
    throw new Error(`${sourceLabel}: TypeScript syntax error: ${msg}`);
  }
  const dictionaries = new Map();

  function unwrapObjectLiteral(expr) {
    let current = expr;
    while (
      current &&
      (ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isParenthesizedExpression(current))
    ) {
      current = current.expression;
    }
    return current && ts.isObjectLiteralExpression(current) ? current : null;
  }

  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) {
      continue;
    }
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) {
        continue;
      }
      const name = decl.name.text;
      if (name !== 'en' && name !== 'ko') {
        continue;
      }
      const obj = unwrapObjectLiteral(decl.initializer);
      if (!obj) {
        throw new Error(`${sourceLabel}: expected object literal for exported "${name}".`);
      }
      const map = new Map();
      for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) {
          throw new Error(`${sourceLabel}: unsupported property syntax in "${name}".`);
        }
        let key;
        if (ts.isStringLiteral(prop.name) || ts.isIdentifier(prop.name)) {
          key = prop.name.text;
        } else {
          throw new Error(`${sourceLabel}: unsupported property key in "${name}".`);
        }
        if (
          !ts.isStringLiteral(prop.initializer) &&
          !ts.isNoSubstitutionTemplateLiteral(prop.initializer)
        ) {
          throw new Error(`${sourceLabel}: non-string literal value for ${name}[${JSON.stringify(key)}].`);
        }
        if (map.has(key)) {
          throw new Error(`${sourceLabel}: duplicate key ${JSON.stringify(key)} in "${name}".`);
        }
        map.set(key, prop.initializer.text);
      }
      dictionaries.set(name, map);
    }
  }

  const enMap = dictionaries.get('en');
  const koMap = dictionaries.get('ko');
  if (!enMap || !koMap) {
    throw new Error(`${sourceLabel}: expected exported "en" and "ko" dictionaries.`);
  }

  const rows = [];
  for (const [key, enVal] of enMap.entries()) {
    if (!koMap.has(key)) {
      throw new Error(`${sourceLabel}: key ${JSON.stringify(key)} exists in en but is missing from ko.`);
    }
    rows.push({ key, en: enVal, ko: koMap.get(key), source: sourceLabel, line: 0 });
  }
  for (const key of koMap.keys()) {
    if (!enMap.has(key)) {
      throw new Error(`${sourceLabel}: key ${JSON.stringify(key)} exists in ko but is missing from en.`);
    }
  }

  return rows;
}

function groupRowsByPrefix(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const prefix = row.key.split('.')[0];
    if (!grouped.has(prefix)) {
      grouped.set(prefix, []);
    }
    grouped.get(prefix).push(row);
  }
  return new Map([...grouped.entries()].sort(([a], [b]) => compareAscii(a, b)));
}

function writeGroupedCsvsAtomic(csvDir, grouped) {
  fs.mkdirSync(csvDir, { recursive: true });
  const existingFiles = listCsvFiles(csvDir);
  const token = `${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`;

  const stagedTargets = [];
  const backedUpExisting = [];
  const committedTargets = [];

  try {
    // Stage every new CSV to a hidden temp file before touching any canonical file.
    for (const [prefix, prefixRows] of grouped.entries()) {
      const targetName = `${prefix}.csv`;
      const targetPath = resolvePrefixCsvPath(csvDir, prefix);
      const tmpPath = path.join(csvDir, `.${targetName}.${token}.tmp`);
      fs.writeFileSync(tmpPath, serializeCsv(prefixRows, { bom: false }), 'utf8');
      stagedTargets.push({ targetPath, tmpPath });
    }

    // Move existing canonical CSVs aside into hidden backups so case-only renames
    // preserve exact target casing on macOS APFS / Windows NTFS and enable full-batch rollback.
    for (const oldName of existingFiles) {
      const oldPath = path.join(csvDir, oldName);
      const backupPath = path.join(csvDir, `.${oldName}.${token}.bak`);
      fs.renameSync(oldPath, backupPath);
      backedUpExisting.push({ oldPath, backupPath });
    }

    for (const item of stagedTargets) {
      fs.renameSync(item.tmpPath, item.targetPath);
      committedTargets.push(item.targetPath);
    }
  } catch (err) {
    for (const targetPath of committedTargets) {
      try {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
      } catch {
        // Best-effort rollback; preserve original error.
      }
    }
    for (const { tmpPath } of stagedTargets) {
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {
        // Best-effort cleanup; preserve original error.
      }
    }
    for (const { oldPath, backupPath } of backedUpExisting) {
      try {
        if (fs.existsSync(backupPath)) {
          fs.renameSync(backupPath, oldPath);
        }
      } catch {
        // Best-effort rollback; preserve original error.
      }
    }
    throw err;
  }

  // Cleanup runs strictly post-commit so an unlink failure can never restore stale files.
  for (const { backupPath } of backedUpExisting) {
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch {
      // Hidden .bak files are ignored by listCsvFiles; keep committed state intact.
    }
  }
}

export async function migrate({
  csvDir = DEFAULT_PATHS.csvDir,
  translationsPath = DEFAULT_PATHS.translationsPath,
  force = false,
} = {}) {
  if (fs.existsSync(csvDir)) {
    const existing = listCsvFiles(csvDir);
    if (existing.length > 0 && !force) {
      throw new Error(
        `Refusing to overwrite ${existing.length} existing CSV file(s) in ${csvDir}. Pass --force to overwrite from ${translationsPath}.`,
      );
    }
  }

  const tsContent = fs.readFileSync(translationsPath, 'utf8');
  const rows = await parseTranslationsTs(tsContent, path.basename(translationsPath));
  validateRows(rows, { csvDir, sourceLabel: path.basename(translationsPath) });

  const grouped = groupRowsByPrefix(rows);
  writeGroupedCsvsAtomic(csvDir, grouped);
  return { fileCount: grouped.size, keyCount: rows.length };
}

export function sync({
  csvDir = DEFAULT_PATHS.csvDir,
  translationsPath = DEFAULT_PATHS.translationsPath,
} = {}) {
  const rows = loadDomainCsvs(csvDir);
  const tsContent = generateTranslationsTs(rows);
  writeFileAtomic(translationsPath, tsContent);
  return { keyCount: rows.length, fileCount: listCsvFiles(csvDir).length };
}

export function check({
  csvDir = DEFAULT_PATHS.csvDir,
  translationsPath = DEFAULT_PATHS.translationsPath,
} = {}) {
  const rows = loadDomainCsvs(csvDir);
  const expected = generateTranslationsTs(rows);

  if (!fs.existsSync(translationsPath)) {
    throw new Error(
      `Generated file missing: ${translationsPath}. Run: npm run i18n:sync`,
    );
  }

  const actual = fs.readFileSync(translationsPath, 'utf8');
  if (actual !== expected) {
    throw new Error(
      `Out-of-sync translations detected: ${translationsPath} does not match ${csvDir}/*.csv. Run: npm run i18n:sync`,
    );
  }

  return { keyCount: rows.length, fileCount: listCsvFiles(csvDir).length };
}

function resolveForContainment(targetPath) {
  let current = path.resolve(targetPath);
  const tail = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(targetPath);
    }
    tail.unshift(path.basename(current));
    current = parent;
  }
  return path.join(fs.realpathSync.native(current), ...tail);
}

function assertNotInsideCsvDir(filePath, csvDir, label) {
  const resolvedCsvDir = resolveForContainment(csvDir);
  const resolvedTarget = resolveForContainment(filePath);
  const rel = path.relative(resolvedCsvDir, resolvedTarget);
  const isOutside = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  if (!isOutside) {
    throw new Error(
      `${label} path ${JSON.stringify(path.resolve(filePath))} must not be inside canonical CSV directory ${resolvedCsvDir}.`,
    );
  }
}

export function exportCsv({
  csvDir = DEFAULT_PATHS.csvDir,
  outPath = DEFAULT_PATHS.exportPath,
} = {}) {
  if (typeof outPath !== 'string' || outPath.trim() === '') {
    throw new Error('Export output path must not be empty. Usage: npm run i18n:export [-- <outPath>]');
  }
  assertNotInsideCsvDir(outPath, csvDir, 'Export output');
  const rows = loadDomainCsvs(csvDir);
  writeFileAtomic(outPath, serializeCsv(rows, { bom: true }));
  return { keyCount: rows.length, outPath };
}

export function importCsv({
  csvDir = DEFAULT_PATHS.csvDir,
  translationsPath = DEFAULT_PATHS.translationsPath,
  inPath,
} = {}) {
  if (typeof inPath !== 'string' || inPath.trim() === '') {
    throw new Error('Missing input CSV path. Usage: npm run i18n:import -- <path-to-csv>');
  }
  assertNotInsideCsvDir(inPath, csvDir, 'Import input');
  const resolvedIn = path.resolve(inPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input CSV file does not exist: ${resolvedIn}`);
  }

  const raw = fs.readFileSync(resolvedIn, 'utf8');
  const rows = parseCsv(raw, path.basename(resolvedIn));
  validateRows(rows, { csvDir, sourceLabel: path.basename(resolvedIn) });

  const grouped = groupRowsByPrefix(rows);
  writeGroupedCsvsAtomic(csvDir, grouped);
  const synced = sync({ csvDir, translationsPath });
  return { keyCount: synced.keyCount, fileCount: synced.fileCount };
}

function usage() {
  return [
    'Usage: node scripts/i18n-csv.mjs <command> [options]',
    '',
    'Commands:',
    '  migrate [--force]     Split frontend/src/i18n/translations.ts into per-prefix CSV files',
    '  sync                  Validate CSV files and regenerate frontend/src/i18n/translations.ts',
    '  check                 Strictly validate CSV files and verify translations.ts has zero drift',
    '  export [outPath]      Export all CSV files into one UTF-8 BOM CSV for spreadsheet editing',
    '  import <inPath>       Validate and import a combined CSV into per-prefix CSVs + translations.ts',
  ].join('\n');
}

function isHelpRequest(args) {
  return args.includes('-h') || args.includes('--help');
}

export async function runCli(argv, paths = DEFAULT_PATHS) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'migrate': {
      if (isHelpRequest(rest)) {
        console.log(usage());
        return 0;
      }
      const unknown = rest.filter((arg) => arg !== '--force');
      if (unknown.length > 0) {
        throw new Error(`Unknown option(s) for migrate: ${unknown.join(', ')}`);
      }
      const force = rest.includes('--force');
      const result = await migrate({
        csvDir: paths.csvDir,
        translationsPath: paths.translationsPath,
        force,
      });
      console.log(`i18n:migrate: wrote ${result.keyCount} keys across ${result.fileCount} CSV files.`);
      return 0;
    }
    case 'sync': {
      if (isHelpRequest(rest)) {
        console.log(usage());
        return 0;
      }
      if (rest.length > 0) {
        throw new Error(`Unexpected argument(s) for sync: ${rest.join(', ')}`);
      }
      const result = sync({
        csvDir: paths.csvDir,
        translationsPath: paths.translationsPath,
      });
      console.log(`i18n:sync: generated translations.ts (${result.keyCount} keys from ${result.fileCount} CSV files).`);
      return 0;
    }
    case 'check': {
      if (isHelpRequest(rest)) {
        console.log(usage());
        return 0;
      }
      if (rest.length > 0) {
        throw new Error(`Unexpected argument(s) for check: ${rest.join(', ')}`);
      }
      const result = check({
        csvDir: paths.csvDir,
        translationsPath: paths.translationsPath,
      });
      console.log(`i18n:check: OK (${result.keyCount} keys across ${result.fileCount} CSV files).`);
      return 0;
    }
    case 'export': {
      if (isHelpRequest(rest)) {
        console.log(usage());
        return 0;
      }
      const flags = rest.filter((arg) => arg.startsWith('-'));
      if (flags.length > 0) {
        throw new Error(`Unknown option(s) for export: ${flags.join(', ')}`);
      }
      if (rest.length > 1) {
        throw new Error(`Expected at most 1 output path for export, got ${rest.length}.`);
      }
      if (rest.length === 1 && rest[0].trim() === '') {
        throw new Error('Export output path must not be empty. Usage: npm run i18n:export [-- <outPath>]');
      }
      const outPath = rest.length === 1 ? path.resolve(rest[0]) : paths.exportPath;
      const result = exportCsv({ csvDir: paths.csvDir, outPath });
      console.log(`i18n:export: wrote ${result.keyCount} keys to ${result.outPath}`);
      return 0;
    }
    case 'import': {
      if (isHelpRequest(rest)) {
        console.log(usage());
        return 0;
      }
      const flags = rest.filter((arg) => arg.startsWith('-'));
      if (flags.length > 0) {
        throw new Error(`Unknown option(s) for import: ${flags.join(', ')}`);
      }
      if (rest.length !== 1) {
        throw new Error('Expected exactly 1 input CSV path. Usage: npm run i18n:import -- <path-to-csv>');
      }
      const result = importCsv({
        csvDir: paths.csvDir,
        translationsPath: paths.translationsPath,
        inPath: rest[0],
      });
      console.log(`i18n:import: imported ${result.keyCount} keys across ${result.fileCount} CSV files and regenerated translations.ts.`);
      return 0;
    }
    case '-h':
    case '--help': {
      console.log(usage());
      return 0;
    }
    case undefined:
      throw new Error(`Missing command.\n\n${usage()}`);
    default:
      throw new Error(`Unknown command ${JSON.stringify(command)}.\n\n${usage()}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli(process.argv.slice(2)).catch((err) => {
    console.error(`i18n-csv: ERROR: ${err.message}`);
    process.exit(1);
  });
}
