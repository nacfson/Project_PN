import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'web-build',
  'src-tauri',
  '.git',
  '.expo',
  'coverage',
]);

const RNTL_ASYNC_FUNCTIONS = new Set([
  'render',
  'renderHook',
  'cleanup',
  'fireEvent',
  'waitFor',
  'waitForElementToBeRemoved',
  'act',
]);

const RNTL_RESULT_ASYNC_METHODS = new Set(['rerender', 'unmount']);
const FIRE_EVENT_ASYNC_METHODS = new Set(['press', 'changeText', 'scroll']);

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    if (IGNORED_DIRS.has(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(walk(full));
    } else if (/\.test\.(ts|tsx|js|jsx)$/.test(item)) {
      files.push(full);
    }
  }
  return files;
}

function isCallToAsyncRntl(node, asyncHelperNames) {
  if (!ts.isCallExpression(node)) return null;

  if (ts.isIdentifier(node.expression)) {
    const name = node.expression.text;
    if (
      RNTL_ASYNC_FUNCTIONS.has(name) ||
      RNTL_RESULT_ASYNC_METHODS.has(name) ||
      asyncHelperNames.has(name)
    ) {
      return name;
    }
  } else if (ts.isPropertyAccessExpression(node.expression)) {
    const obj = node.expression.expression;
    const prop = node.expression.name.text;
    if (ts.isIdentifier(obj) && obj.text === 'fireEvent' && FIRE_EVENT_ASYNC_METHODS.has(prop)) {
      return `fireEvent.${prop}`;
    }
  }
  return null;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('@testing-library/react-native')) {
    return [];
  }

  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const asyncHelperNames = new Set();

  // Pass 1: discover local helper functions that return a call to an async RNTL function
  function collectHelpers(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      let returnsAsyncRntl = false;
      function scanBody(child) {
        if (ts.isReturnStatement(child) && child.expression) {
          const expr = ts.isAwaitExpression(child.expression)
            ? child.expression.expression
            : child.expression;
          if (isCallToAsyncRntl(expr, asyncHelperNames)) {
            returnsAsyncRntl = true;
          }
        }
        ts.forEachChild(child, scanBody);
      }
      scanBody(node.body);
      if (returnsAsyncRntl) {
        asyncHelperNames.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectHelpers);
  }
  collectHelpers(sf);

  // Pass 2: check that all calls to async RNTL functions or helpers are awaited/returned
  const errors = [];
  function visit(node) {
    const calleeName = isCallToAsyncRntl(node, asyncHelperNames);
    if (calleeName && ts.isExpressionStatement(node.parent)) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
      errors.push({
        file: filePath,
        line: line + 1,
        col: character + 1,
        calleeName,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  return errors;
}

const targetDirs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const targets = targetDirs.length > 0 ? targetDirs : ['frontend'];

let totalFiles = 0;
const allErrors = [];

for (const target of targets) {
  const fullTarget = path.resolve(process.cwd(), target);
  if (!fs.existsSync(fullTarget)) continue;

  const stat = fs.statSync(fullTarget);
  const files = stat.isDirectory() ? walk(fullTarget) : [fullTarget];
  totalFiles += files.length;

  for (const file of files) {
    allErrors.push(...checkFile(file));
  }
}

if (allErrors.length > 0) {
  console.error('\n❌ Unawaited @testing-library/react-native v14 async call(s) found:');
  for (const err of allErrors) {
    const relFile = path.relative(process.cwd(), err.file);
    console.error(
      `  ${relFile}:${err.line}:${err.col} -> "${err.calleeName}(...)" returns a Promise in RNTL v14 and must be awaited (or returned)`,
    );
  }
  console.error(
    `\nFound ${allErrors.length} unawaited RNTL call(s) across ${totalFiles} test file(s).\n`,
  );
  process.exit(1);
}

console.log(`✅ All RNTL v14 async calls are properly awaited (${totalFiles} test files checked).`);
process.exit(0);
