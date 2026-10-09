import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Supported extensions for module resolution
const EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.web.ts',
  '.web.tsx',
  '.web.js',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.mjs',
];

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'web-build',
  'src-tauri',
  '.git',
  '.expo',
  'coverage',
]);

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const errors = [];

  function checkSpecifier(specifier, node) {
    if (specifier && (specifier.startsWith('./') || specifier.startsWith('../'))) {
      const dir = path.dirname(filePath);
      const resolved = path.resolve(dir, specifier);
      const found = EXTENSIONS.some((ext) => {
        const candidate = resolved + ext;
        try {
          return fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory();
        } catch {
          return false;
        }
      });

      if (!found) {
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
        errors.push({
          file: filePath,
          line: line + 1,
          col: character + 1,
          specifier,
        });
      }
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        checkSpecifier(node.moduleSpecifier.text, node.moduleSpecifier);
      }
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      ) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          checkSpecifier(arg.text, arg);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return errors;
}

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    if (IGNORED_DIRS.has(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(walk(full));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(item)) {
      files.push(full);
    }
  }
  return files;
}

const targetDirs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const targets = targetDirs.length > 0 ? targetDirs : ['frontend', 'browser-extension', 'packages'];

let totalFiles = 0;
const allErrors = [];

for (const target of targets) {
  const fullTarget = path.resolve(process.cwd(), target);
  if (!fs.existsSync(fullTarget)) continue;

  const stat = fs.statSync(fullTarget);
  const files = stat.isDirectory() ? walk(fullTarget) : [fullTarget];
  totalFiles += files.length;

  for (const file of files) {
    const errs = checkFile(file);
    allErrors.push(...errs);
  }
}

if (allErrors.length > 0) {
  console.error('\n❌ Module resolution errors found:');
  for (const err of allErrors) {
    const relFile = path.relative(process.cwd(), err.file);
    console.error(`  ${relFile}:${err.line}:${err.col} -> Cannot resolve relative module "${err.specifier}"`);
  }
  console.error(`\nFound ${allErrors.length} unresolved import(s) across ${totalFiles} scanned files.\n`);
  process.exit(1);
}

console.log(`✅ All module imports resolved successfully (${totalFiles} files checked).`);
process.exit(0);
