const fs = require('fs');
const path = require('path');
const ts = require(path.join(process.cwd(), 'frontend/node_modules/typescript'));

const ROOT = path.join(process.cwd(), 'frontend/src');
const EXCLUDE_DIRS = new Set(['node_modules','.expo','dist','src-tauri','__pycache__','.tmp']);
const TEXT_PROPS = new Set([
  'label','placeholder','title','message','description','helperText','accessibilityLabel','accessibilityHint','header','caption','text','hint'
]);

function isExcluded(p) {
  return p.split(path.sep).some(part => EXCLUDE_DIRS.has(part));
}

function getText(node) {
  if (!node) return '';
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + '...';
  return '';
}

function walk(sourceFile, cb) {
  function visit(node) {
    cb(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const usage = {};
const rawText = [];

function addUsage(key, file, line, snippet) {
  usage[key] = usage[key] || [];
  usage[key].push({file, line, snippet});
}

function addRaw(type, file, line, detail) {
  rawText.push({file, line, type, detail});
}

function collectFiles(dir, out=[]) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isExcluded(full)) collectFiles(full, out);
    } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      out.push(full);
    }
  }
  return out;
}

const files = collectFiles(ROOT);

for (const file of files) {
  const source = fs.readFileSync(file, 'utf-8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  walk(sourceFile, (node) => {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      const first = node.arguments[0];
      const key = getText(first);
      if (key) {
        const snippet = source.split('\n')[line-1]?.trim() || '';
        addUsage(key, path.relative(process.cwd(), file), line, snippet);
      }
    }
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text && /[A-Za-z]/.test(text) && !/^\.*$/.test(text)) {
        addRaw('JsxText', path.relative(process.cwd(), file), line, text);
      }
    }
    if (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent)) {
      const attrName = node.parent.name.text;
      if (TEXT_PROPS.has(attrName)) {
        addRaw(`JsxAttr:${attrName}`, path.relative(process.cwd(), file), line, node.text);
      }
    }
    if (ts.isStringLiteral(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const text = node.text.trim();
      if (text && /[A-Za-z]/.test(text)) {
        addRaw('JsxChildString', path.relative(process.cwd(), file), line, text);
      }
    }
  });
}

const transPath = path.join(process.cwd(), 'frontend/src/i18n/translations.ts');
const transSource = fs.readFileSync(transPath, 'utf-8');
const transFile = ts.createSourceFile(transPath, transSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const enKeys = new Set();
function walkTrans(node) {
  if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) {
    enKeys.add(node.name.text);
  }
  ts.forEachChild(node, walkTrans);
}
walkTrans(transFile);

const usedKeys = Object.keys(usage);
const unused = [...enKeys].filter(k => !usage[k]).sort();
const missing = usedKeys.filter(k => !enKeys.has(k)).sort();

const out = {files: files.length, uniqueKeys: usedKeys.length, unused, missing, usage, rawText};
fs.writeFileSync('.tmp/audit_translations_ts.json', JSON.stringify(out, null, 2), 'utf-8');
console.log('Files:', files.length);
console.log('Unique t keys:', usedKeys.length);
console.log('Raw text candidates:', rawText.length);
console.log('Unused keys:', unused.length);
console.log('Missing keys:', missing.length);
