import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_PATHS,
  PLACEHOLDER_RE,
  check,
  compareAscii,
  exportCsv,
  extractPlaceholders,
  formatTsString,
  generateTranslationsTs,
  importCsv,
  loadDomainCsvs,
  migrate,
  parseCsv,
  parseTranslationsTs,
  resolvePrefixCsvPath,
  runCli,
  serializeCsv,
  sync,
  validatePlaceholderParity,
  validateRows,
} from './i18n-csv.mjs';

function makeTempWorkspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-i18n-csv-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const csvDir = path.join(root, 'csv');
  const translationsPath = path.join(root, 'translations.ts');
  const exportPath = path.join(root, 'translations.export.csv');
  fs.mkdirSync(csvDir, { recursive: true });
  return { root, csvDir, translationsPath, exportPath };
}

test('RFC 4180 round-trip preserves commas, doubled quotes, multi-line cells, Korean text, and intentional padding', () => {
  const inputRows = [
    { key: 'common.quote', en: 'Say "hello", world', ko: '"안녕", 세상아' },
    {
      key: 'import.csvPlaceholder',
      en: 'Front,Back,Tags\nrun,to move quickly,verbs',
      ko: 'Front,Back,Tags\nrun,빠르게 달리다,동사',
    },
    { key: 'common.padded', en: '  spaced value  ', ko: '  여백 값  ' },
  ];

  const serialized = serializeCsv(inputRows, { bom: true });
  assert.equal(serialized.startsWith('\uFEFF'), true);
  assert.equal(serialized.includes('\r'), false);

  const crlfWithLoneCr = serialized.replace(/\n/g, '\r\n').replace('run,to', 'run,\rto');
  const parsed = parseCsv(crlfWithLoneCr, 'roundtrip.csv');
  assert.equal(parsed.length, inputRows.length);
  assert.equal(parsed[0].en, inputRows[0].en);
  assert.equal(parsed[0].ko, inputRows[0].ko);
  assert.equal(parsed[1].en, 'Front,Back,Tags\nrun,\nto move quickly,verbs');
  assert.equal(parsed[1].ko, inputRows[1].ko);
  assert.equal(parsed[2].en, '  spaced value  ');
  assert.equal(parsed[2].ko, '  여백 값  ');
});

test('parseCsv rejects malformed headers, bad column counts, broken quotes, and blank lines', () => {
  assert.throws(() => parseCsv('', 'empty.csv'), /empty/);
  assert.throws(() => parseCsv('id,en,ko\na.b,hi,안녕\n', 'bad-header.csv'), /invalid CSV header/);
  assert.throws(() => parseCsv('key,en,ko\na.b,only-two\n', 'two-cols.csv'), /expected 3 columns/);
  assert.throws(() => parseCsv('key,en,ko\na.b,unquoted, comma,안녕\n', 'four-cols.csv'), /expected 3 columns/);
  assert.throws(() => parseCsv('key,en,ko\na.b,"unclosed,안녕\n', 'unclosed.csv'), /unclosed quoted field/);
  assert.throws(() => parseCsv('key,en,ko\na.b,"abc"extra,안녕\n', 'trailing.csv'), /after closing quote/);
  assert.throws(() => parseCsv('key,en,ko\na.b,ab"c,안녕\n', 'bare-quote.csv'), /unescaped quote/);
  assert.throws(() => parseCsv('key,en,ko\na.b,hi,안녕\n\na.c,yo,야\n', 'blank-mid.csv'), /blank line/);
  assert.throws(() => parseCsv('key,en,ko\na.b,hi,안녕\n\n', 'blank-end.csv'), /blank line/);

  // Optional final EOF newline is accepted whether present or omitted, including quoted final fields.
  assert.equal(parseCsv('key,en,ko\na.b,hi,안녕', 'no-eof-nl.csv').length, 1);
  assert.equal(parseCsv('key,en,ko\na.b,hi,안녕\n', 'with-eof-nl.csv').length, 1);
  const quotedEof = parseCsv('key,en,ko\na.b,hi,"안녕, 세상"', 'quoted-eof-no-nl.csv');
  assert.equal(quotedEof.length, 1);
  assert.equal(quotedEof[0].ko, '안녕, 세상');
});

test('validateRows blocks path traversal, invalid key grammar, case-colliding prefixes, duplicates, and whitespace-only values', () => {
  assert.throws(() => validateRows([], { sourceLabel: 'empty.csv' }), /at least one row/);

  const badKeys = [
    'foo/../../outside.bar',
    '../evil.key',
    'a\\b.c',
    'orphan',
    '.leadingDot',
    'trailingDot.',
    'double..dot',
    ' auth.title',
    'auth.title ',
    '1bad.key',
  ];
  for (const key of badKeys) {
    assert.throws(
      () => validateRows([{ key, en: 'Hello', ko: '안녕' }]),
      /invalid translation key|leading or trailing whitespace/,
      `expected key ${JSON.stringify(key)} to be rejected`,
    );
  }

  assert.throws(
    () => resolvePrefixCsvPath('/tmp/csv', '../escape'),
    /Invalid CSV prefix/,
  );

  assert.throws(
    () =>
      validateRows([
        { key: 'Home.title', en: 'Home', ko: '홈' },
        { key: 'home.subtitle', en: 'Sub', ko: '부제' },
      ]),
    /case-colliding prefix/,
  );

  assert.throws(
    () =>
      validateRows([
        { key: 'auth.signIn', en: 'Sign in', ko: '로그인' },
        { key: 'auth.signIn', en: 'Sign in', ko: '로그인' },
      ]),
    /duplicate translation key/,
  );

  assert.throws(
    () => validateRows([{ key: 'auth.signIn', en: 'Sign in', ko: '로그인' }], { expectedPrefix: 'home' }),
    /belongs to prefix/,
  );

  assert.throws(() => validateRows([{ key: 'auth.emptyEn', en: '   ', ko: '값' }]), /empty en/);
  assert.throws(() => validateRows([{ key: 'auth.emptyKo', en: 'Value', ko: '\t\n ' }]), /empty ko/);
});

test('placeholder parity supports double braces, reordered tokens, and the queue.adding allowlist while rejecting mismatches', () => {
  validatePlaceholderParity('add.addedToDeck', 'Added "{{word}}" to {{deck}}', '"{{word}}"를 {{deck}}에 추가했습니다');
  validatePlaceholderParity('words.summary', '{words} words in {decks} decks', '{decks}개 덱에 {words}개 단어');
  validatePlaceholderParity('queue.adding', 'Adding {count} word{plural}...', '{count}개 단어 추가 중...');

  assert.throws(
    () => validatePlaceholderParity('queue.adding', 'Adding {count} word{plural}...', '단어 추가 중...'),
    /missing placeholder\(s\) in ko: count/,
  );
  assert.throws(
    () => validatePlaceholderParity('queue.adding', 'Adding {count} word{plural}...', '{count}{extra}'),
    /missing from en: extra/,
  );
  assert.throws(
    () => validatePlaceholderParity('today.headlineDue', '{count} words are due', '오늘 복습할 단어가 있습니다'),
    /missing placeholder\(s\) in ko: count/,
  );

  // External mutation of exported PLACEHOLDER_RE.lastIndex must not skip earlier tokens.
  PLACEHOLDER_RE.lastIndex = 0;
  PLACEHOLDER_RE.exec('prefix {a} middle {b}');
  assert.equal(PLACEHOLDER_RE.lastIndex > 0, true);
  assert.deepEqual([...extractPlaceholders('{a} and {b}')], ['a', 'b']);
  PLACEHOLDER_RE.lastIndex = 0;
});

test('formatTsString escapes quotes, backslashes, newlines, tabs, and unicode line separators cleanly', () => {
  const raw = `it's "quoted" \\ path\nline2\tcol\u2028sep\u2029end`;
  const literal = formatTsString(raw);
  const evaluated = new Function(`return ${literal};`)();
  assert.equal(evaluated, raw);
});

test('loadDomainCsvs ignores non-CSV dotfiles, uses ASCII filename sort, and rejects empty dirs or header-only files', (t) => {
  const { csvDir } = makeTempWorkspace(t);

  assert.throws(() => loadDomainCsvs(csvDir), /No \.csv files found/);

  fs.writeFileSync(path.join(csvDir, '.DS_Store'), 'junk', 'utf8');
  fs.writeFileSync(path.join(csvDir, 'notes.txt'), 'ignore', 'utf8');
  assert.throws(() => loadDomainCsvs(csvDir), /No \.csv files found/);

  fs.writeFileSync(path.join(csvDir, 'headerOnly.csv'), 'key,en,ko\n', 'utf8');
  assert.throws(() => loadDomainCsvs(csvDir), /at least one row/);
  fs.unlinkSync(path.join(csvDir, 'headerOnly.csv'));

  // Mixed-case filenames: ASCII sort places uppercase before lowercase deterministically.
  fs.writeFileSync(path.join(csvDir, 'alpha.csv'), 'key,en,ko\nalpha.one,One,하나\n', 'utf8');
  fs.writeFileSync(path.join(csvDir, 'Zeta.csv'), 'key,en,ko\nZeta.one,Z,제트\n', 'utf8');

  const rows = loadDomainCsvs(csvDir);
  assert.deepEqual(
    rows.map((r) => r.key),
    ['Zeta.one', 'alpha.one'],
  );
  assert.equal(compareAscii('Zeta.csv', 'alpha.csv') < 0, true);
});

test('sync, check, drift detection, export, and import round-trip work end to end without losing data on bad import', (t) => {
  const { csvDir, translationsPath, exportPath, root } = makeTempWorkspace(t);

  fs.writeFileSync(
    path.join(csvDir, 'auth.csv'),
    serializeCsv([
      { key: 'auth.signIn', en: 'Sign in', ko: '로그인' },
      { key: 'auth.msg', en: 'Hello, "friend"\nWelcome', ko: '안녕, "친구"\n환영해' },
    ]),
    'utf8',
  );
  fs.writeFileSync(
    path.join(csvDir, 'home.csv'),
    serializeCsv([{ key: 'home.count', en: '{count} items', ko: '{count}개 항목' }]),
    'utf8',
  );

  sync({ csvDir, translationsPath });
  const initialTs = fs.readFileSync(translationsPath, 'utf8');
  assert.equal(initialTs.startsWith('\uFEFF'), false);
  assert.equal(initialTs.includes('\r'), false);
  check({ csvDir, translationsPath });

  // Drift detection fails when generated file is modified.
  fs.writeFileSync(translationsPath, `${initialTs}\n// manual edit\n`, 'utf8');
  assert.throws(() => check({ csvDir, translationsPath }), /Out-of-sync/);
  sync({ csvDir, translationsPath });

  // Unmodified export -> import must produce byte-for-byte identical CSVs and translations.ts.
  const beforeAuth = fs.readFileSync(path.join(csvDir, 'auth.csv'), 'utf8');
  const beforeHome = fs.readFileSync(path.join(csvDir, 'home.csv'), 'utf8');
  exportCsv({ csvDir, outPath: exportPath });
  const exportedRaw = fs.readFileSync(exportPath, 'utf8');
  assert.equal(exportedRaw.startsWith('\uFEFF'), true);

  importCsv({ csvDir, translationsPath, inPath: exportPath });
  assert.equal(fs.readFileSync(path.join(csvDir, 'auth.csv'), 'utf8'), beforeAuth);
  assert.equal(fs.readFileSync(path.join(csvDir, 'home.csv'), 'utf8'), beforeHome);
  assert.equal(fs.readFileSync(translationsPath, 'utf8'), initialTs);

  // Invalid import (0 rows or bad placeholder) leaves existing files completely untouched.
  const emptyImport = path.join(root, 'empty.csv');
  fs.writeFileSync(emptyImport, 'key,en,ko\n', 'utf8');
  assert.throws(() => importCsv({ csvDir, translationsPath, inPath: emptyImport }), /at least one row/);
  assert.equal(fs.readFileSync(path.join(csvDir, 'auth.csv'), 'utf8'), beforeAuth);
  assert.equal(fs.readFileSync(path.join(csvDir, 'home.csv'), 'utf8'), beforeHome);

  const badPlaceholderImport = path.join(root, 'bad-ph.csv');
  fs.writeFileSync(badPlaceholderImport, 'key,en,ko\nhome.count,{count} items,항목\n', 'utf8');
  assert.throws(() => importCsv({ csvDir, translationsPath, inPath: badPlaceholderImport }), /missing placeholder/);
  assert.equal(fs.readFileSync(path.join(csvDir, 'auth.csv'), 'utf8'), beforeAuth);
  assert.equal(fs.readFileSync(path.join(csvDir, 'home.csv'), 'utf8'), beforeHome);

  // Valid import removing a prefix removes stale prefix file and regenerates translations.ts.
  const prunedImport = path.join(root, 'pruned.csv');
  fs.writeFileSync(prunedImport, 'key,en,ko\nauth.signIn,Log in,로그인\n', 'utf8');
  importCsv({ csvDir, translationsPath, inPath: prunedImport });
  assert.equal(fs.existsSync(path.join(csvDir, 'home.csv')), false);
  assert.equal(fs.existsSync(path.join(csvDir, 'auth.csv')), true);
  check({ csvDir, translationsPath });
});

test('migrate refuses overwriting non-empty csvDir without --force and succeeds with --force', async (t) => {
  const { csvDir, translationsPath } = makeTempWorkspace(t);

  const tsSource = generateTranslationsTs([
    { key: 'common.ok', en: 'OK', ko: '확인' },
    { key: 'tabs.home', en: 'Home', ko: '홈' },
  ]);
  fs.writeFileSync(translationsPath, tsSource, 'utf8');

  const first = await migrate({ csvDir, translationsPath });
  assert.deepEqual(first, { fileCount: 2, keyCount: 2 });

  await assert.rejects(() => migrate({ csvDir, translationsPath }), /Pass --force/);

  fs.writeFileSync(path.join(csvDir, 'stale.csv'), 'key,en,ko\nstale.x,Old,구\n', 'utf8');
  const forced = await migrate({ csvDir, translationsPath, force: true });
  assert.deepEqual(forced, { fileCount: 2, keyCount: 2 });
  assert.equal(fs.existsSync(path.join(csvDir, 'stale.csv')), false);
});

test('case-only prefix rename via importCsv and migrate preserves the renamed file without data loss', async (t) => {
  const { csvDir, translationsPath, root } = makeTempWorkspace(t);

  fs.writeFileSync(
    path.join(csvDir, 'commandDock.csv'),
    'key,en,ko\ncommandDock.addWord,Add word,단어 추가\n',
    'utf8',
  );
  sync({ csvDir, translationsPath });

  const renamedCsv = path.join(root, 'renamed.csv');
  fs.writeFileSync(
    renamedCsv,
    'key,en,ko\ncommanddock.addWord,Add word,단어 추가\n',
    'utf8',
  );
  importCsv({ csvDir, translationsPath, inPath: renamedCsv });

  const filesAfterImport = fs.readdirSync(csvDir);
  assert.deepEqual(filesAfterImport, ['commanddock.csv']);
  assert.equal(
    fs.readFileSync(path.join(csvDir, 'commanddock.csv'), 'utf8'),
    'key,en,ko\ncommanddock.addWord,Add word,단어 추가\n',
  );
  check({ csvDir, translationsPath });

  // Rename back via migrate --force.
  const backTs = generateTranslationsTs([
    { key: 'commandDock.addWord', en: 'Add word', ko: '단어 추가' },
  ]);
  fs.writeFileSync(translationsPath, backTs, 'utf8');
  await migrate({ csvDir, translationsPath, force: true });
  assert.deepEqual(fs.readdirSync(csvDir), ['commandDock.csv']);
  check({ csvDir, translationsPath });
});

test('writeGroupedCsvsAtomic rolls back full batch on mid-commit failure and keeps committed files on post-commit cleanup error', (t) => {
  const { csvDir, translationsPath, root } = makeTempWorkspace(t);

  const origAuth = 'key,en,ko\nauth.signIn,Sign in,로그인\n';
  const origHome = 'key,en,ko\nhome.title,Home,홈\n';
  fs.writeFileSync(path.join(csvDir, 'auth.csv'), origAuth, 'utf8');
  fs.writeFileSync(path.join(csvDir, 'home.csv'), origHome, 'utf8');
  sync({ csvDir, translationsPath });

  // Inject failure on the second staged-to-target commit rename; entire batch must roll back.
  const newImport = path.join(root, 'batch.csv');
  fs.writeFileSync(
    newImport,
    'key,en,ko\nauth.signIn,Log in,접속\nhome.title,Main,메인\n',
    'utf8',
  );
  const origRenameSync = fs.renameSync;
  let commitRenames = 0;
  const renameMock = t.mock.method(fs, 'renameSync', (from, to) => {
    if (String(from).endsWith('.tmp') && String(to).endsWith('.csv')) {
      commitRenames += 1;
      if (commitRenames === 2) {
        throw new Error('simulated ENOSPC on second prefix');
      }
    }
    return origRenameSync(from, to);
  });

  assert.throws(() => importCsv({ csvDir, translationsPath, inPath: newImport }), /simulated ENOSPC/);
  renameMock.mock.restore();

  assert.deepEqual(fs.readdirSync(csvDir).sort(), ['auth.csv', 'home.csv']);
  assert.equal(fs.readFileSync(path.join(csvDir, 'auth.csv'), 'utf8'), origAuth);
  assert.equal(fs.readFileSync(path.join(csvDir, 'home.csv'), 'utf8'), origHome);
  check({ csvDir, translationsPath });

  // Post-commit backup unlink failure after a case-only rename must NOT restore old casing alongside new file.
  fs.rmSync(path.join(csvDir, 'auth.csv'));
  fs.rmSync(path.join(csvDir, 'home.csv'));
  fs.writeFileSync(path.join(csvDir, 'commandDock.csv'), 'key,en,ko\ncommandDock.a,A,에이\n', 'utf8');
  sync({ csvDir, translationsPath });

  const caseRenameImport = path.join(root, 'case-rename.csv');
  fs.writeFileSync(caseRenameImport, 'key,en,ko\ncommanddock.a,A,에이\n', 'utf8');
  const origUnlinkSync = fs.unlinkSync;
  const unlinkMock = t.mock.method(fs, 'unlinkSync', (target) => {
    if (String(target).endsWith('.bak')) {
      throw new Error('simulated EBUSY on backup cleanup');
    }
    return origUnlinkSync(target);
  });

  importCsv({ csvDir, translationsPath, inPath: caseRenameImport });
  unlinkMock.mock.restore();

  const nonHidden = fs.readdirSync(csvDir).filter((name) => !name.startsWith('.'));
  assert.deepEqual(nonHidden, ['commanddock.csv']);
  check({ csvDir, translationsPath });
});

test('listCsvFiles and loadDomainCsvs fail closed on uppercase .CSV, symlinks, directories, missing dir, invalid filename, and case collisions', async (t) => {
  const { csvDir, translationsPath, root } = makeTempWorkspace(t);

  assert.throws(() => loadDomainCsvs(path.join(root, 'does-not-exist')), /does not exist/);

  // Symlinked .csv and directory .csv entries must fail closed instead of being skipped.
  const outsideCsv = path.join(root, 'outside.csv');
  fs.writeFileSync(outsideCsv, 'key,en,ko\nextra.a,A,에이\n', 'utf8');
  fs.symlinkSync(outsideCsv, path.join(csvDir, 'extra.csv'));
  assert.throws(() => loadDomainCsvs(csvDir), /regular file/);
  fs.unlinkSync(path.join(csvDir, 'extra.csv'));

  fs.mkdirSync(path.join(csvDir, 'folder.csv'));
  assert.throws(() => loadDomainCsvs(csvDir), /regular file/);
  fs.rmdirSync(path.join(csvDir, 'folder.csv'));

  // Uppercase/mixed-case .CSV extension must fail closed in loadDomainCsvs and migrate.
  fs.writeFileSync(path.join(csvDir, 'billing.CSV'), 'key,en,ko\nbilling.title,Pay,결제\n', 'utf8');
  assert.throws(() => loadDomainCsvs(csvDir), /lowercase "\.csv" extension/);
  fs.writeFileSync(
    translationsPath,
    generateTranslationsTs([{ key: 'common.ok', en: 'OK', ko: '확인' }]),
    'utf8',
  );
  await assert.rejects(() => migrate({ csvDir, translationsPath }), /lowercase "\.csv" extension/);
  fs.unlinkSync(path.join(csvDir, 'billing.CSV'));

  // Invalid prefix filename.
  fs.writeFileSync(path.join(csvDir, '1bad.csv'), 'key,en,ko\n1bad.a,A,에이\n', 'utf8');
  assert.throws(() => loadDomainCsvs(csvDir), /Invalid CSV filename/);
  fs.unlinkSync(path.join(csvDir, '1bad.csv'));

  // Case-colliding filenames on case-sensitive filesystems (Linux CI).
  fs.writeFileSync(path.join(csvDir, 'Home.csv'), 'key,en,ko\nHome.a,A,에이\n', 'utf8');
  fs.writeFileSync(path.join(csvDir, 'home.csv'), 'key,en,ko\nhome.b,B,비\n', 'utf8');
  if (fs.readdirSync(csvDir).length === 2) {
    assert.throws(() => loadDomainCsvs(csvDir), /Case-colliding CSV filenames/);
  }
});

test('check, exportCsv, and importCsv reject missing inputs and paths inside csvDir', (t) => {
  const { csvDir, translationsPath, root } = makeTempWorkspace(t);
  fs.writeFileSync(path.join(csvDir, 'auth.csv'), 'key,en,ko\nauth.signIn,Sign in,로그인\n', 'utf8');

  assert.throws(() => check({ csvDir, translationsPath }), /Generated file missing/);
  assert.throws(() => exportCsv({ csvDir, outPath: '' }), /must not be empty/);
  assert.throws(() => exportCsv({ csvDir, outPath: '   ' }), /must not be empty/);
  assert.throws(() => importCsv({ csvDir, translationsPath, inPath: '' }), /Missing input CSV path/);
  assert.throws(() => importCsv({ csvDir, translationsPath, inPath: '   ' }), /Missing input CSV path/);
  assert.throws(
    () => importCsv({ csvDir, translationsPath, inPath: path.join(root, 'missing.csv') }),
    /does not exist/,
  );

  // Containment checks: direct file, csvDir itself, ".."-prefixed child, nested non-existent subdir, and symlinks.
  assert.throws(
    () => importCsv({ csvDir, translationsPath, inPath: path.join(csvDir, 'auth.csv') }),
    /must not be inside canonical CSV directory/,
  );
  assert.throws(
    () => exportCsv({ csvDir, outPath: path.join(csvDir, 'export.csv') }),
    /must not be inside canonical CSV directory/,
  );
  assert.throws(
    () => exportCsv({ csvDir, outPath: path.join(csvDir, '..export.csv') }),
    /must not be inside canonical CSV directory/,
  );
  assert.throws(
    () => exportCsv({ csvDir, outPath: path.join(csvDir, '..tmp', 'out.csv') }),
    /must not be inside canonical CSV directory/,
  );
  assert.throws(
    () => importCsv({ csvDir, translationsPath, inPath: path.join(csvDir, '..export.csv') }),
    /must not be inside canonical CSV directory/,
  );
  assert.throws(
    () => exportCsv({ csvDir, outPath: csvDir }),
    /must not be inside canonical CSV directory/,
  );
  assert.throws(
    () => exportCsv({ csvDir, outPath: path.join(csvDir, 'nested', 'deep', 'export.csv') }),
    /must not be inside canonical CSV directory/,
  );

  const linkToCsvDir = path.join(root, 'csv-link');
  fs.symlinkSync(csvDir, linkToCsvDir);
  assert.throws(
    () => exportCsv({ csvDir, outPath: path.join(linkToCsvDir, 'nested', 'out.csv') }),
    /must not be inside canonical CSV directory/,
  );
  assert.throws(
    () => importCsv({ csvDir, translationsPath, inPath: path.join(linkToCsvDir, 'auth.csv') }),
    /must not be inside canonical CSV directory/,
  );
});

test('parseTranslationsTs rejects syntax errors and malformed dictionary AST shapes', async () => {
  await assert.rejects(() => parseTranslationsTs('export const en = { broken'), /syntax error/);
  await assert.rejects(() => parseTranslationsTs('export const en = { "a.b": "x" };'), /expected exported "en" and "ko"/);
  await assert.rejects(
    () => parseTranslationsTs('export const en = getEn(); export const ko = {};'),
    /expected object literal/,
  );
  await assert.rejects(
    () => parseTranslationsTs('export const en = { ...other }; export const ko = {};'),
    /unsupported property syntax/,
  );
  await assert.rejects(
    () => parseTranslationsTs('export const en = { [k]: "v" }; export const ko = {};'),
    /unsupported property key/,
  );
  await assert.rejects(
    () => parseTranslationsTs('export const en = { "a.b": 123 }; export const ko = { "a.b": "x" };'),
    /non-string literal value/,
  );
  await assert.rejects(
    () => parseTranslationsTs('export const en = { "a.b": "1", "a.b": "2" }; export const ko = { "a.b": "1" };'),
    /duplicate key/,
  );
  await assert.rejects(
    () => parseTranslationsTs('export const en = { "a.b": "1" }; export const ko = {};'),
    /missing from ko/,
  );
  await assert.rejects(
    () => parseTranslationsTs('export const en = {}; export const ko = { "a.b": "1" };'),
    /missing from en/,
  );
});

test('runCli covers all commands, help flags, and error paths without mutating process.exitCode', async (t) => {
  const { csvDir, translationsPath, exportPath, root } = makeTempWorkspace(t);
  const paths = { csvDir, translationsPath, exportPath };

  const initialTs = generateTranslationsTs([
    { key: 'common.ok', en: 'OK', ko: '확인' },
    { key: 'tabs.home', en: 'Home', ko: '홈' },
  ]);
  fs.writeFileSync(translationsPath, initialTs, 'utf8');

  const prevExitCode = process.exitCode;
  await assert.rejects(() => runCli([], paths), /Missing command/);
  assert.equal(process.exitCode, prevExitCode);
  await assert.rejects(() => runCli(['bogus'], paths), /Unknown command/);

  assert.equal(await runCli(['--help'], paths), 0);
  assert.equal(await runCli(['-h'], paths), 0);
  assert.equal(await runCli(['export', '--help'], paths), 0);
  assert.equal(fs.existsSync(path.resolve('--help')), false);
  assert.equal(await runCli(['import', '--help'], paths), 0);
  assert.equal(await runCli(['migrate', '--help'], paths), 0);
  assert.equal(await runCli(['sync', '--help'], paths), 0);
  assert.equal(await runCli(['check', '--help'], paths), 0);

  await assert.rejects(() => runCli(['migrate', '--bad'], paths), /Unknown option/);
  await assert.rejects(() => runCli(['sync', 'extra'], paths), /Unexpected argument/);
  await assert.rejects(() => runCli(['check', 'extra'], paths), /Unexpected argument/);
  await assert.rejects(() => runCli(['export', '--bogus'], paths), /Unknown option/);
  await assert.rejects(() => runCli(['export', ''], paths), /must not be empty/);
  assert.equal(fs.existsSync(exportPath), false);
  await assert.rejects(() => runCli(['export', 'a.csv', 'b.csv'], paths), /Expected at most 1/);
  await assert.rejects(() => runCli(['import', '--bogus'], paths), /Unknown option/);
  await assert.rejects(() => runCli(['import'], paths), /Expected exactly 1/);
  await assert.rejects(() => runCli(['import', 'a.csv', 'b.csv'], paths), /Expected exactly 1/);

  assert.equal(await runCli(['migrate'], paths), 0);
  assert.equal(await runCli(['migrate', '--force'], paths), 0);
  assert.equal(await runCli(['sync'], paths), 0);
  assert.equal(await runCli(['check'], paths), 0);

  // Default export path when no positional path is provided.
  assert.equal(await runCli(['export'], paths), 0);
  assert.equal(fs.existsSync(exportPath), true);

  const customOut = path.join(root, 'custom.csv');
  assert.equal(await runCli(['export', customOut], paths), 0);
  assert.equal(fs.existsSync(customOut), true);
  assert.equal(await runCli(['import', customOut], paths), 0);
  assert.equal(await runCli(['check'], paths), 0);
});

test('runCli handles check on the live repository cleanly (data-agnostic)', async () => {
  const result = check(DEFAULT_PATHS);
  assert.equal(result.keyCount > 0, true);
  assert.equal(result.fileCount > 0, true);
  assert.equal(await runCli(['check'], DEFAULT_PATHS), 0);
});
