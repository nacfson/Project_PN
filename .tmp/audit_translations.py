import re, os, json
from pathlib import Path

ROOT = Path('frontend/src')
EXCLUDE_DIRS = {'node_modules', '.expo', 'dist', 'src-tauri', '__pycache__', '.tmp'}

t_pattern = re.compile(r"t\(\s*['\"]([^'\"]+)['\"]")
# crude JSX text: >...< not containing tags/braces and not just whitespace
jsx_text_pattern = re.compile(r">([^{}<>]*?)<")
# string literal in JSX expression or prop: '...' or "..." with letters
str_literal_pattern = re.compile(r"['\"]([A-Za-z][A-Za-z0-9\s\.,!?%$'-]{2,})['\"]")

usage = {}
jsx_texts = []
raw_strings = []
files_scanned = 0

for p in ROOT.rglob('*'):
    if not p.is_file():
        continue
    if p.suffix not in ('.ts', '.tsx'):
        continue
    if any(part in EXCLUDE_DIRS for part in p.parts):
        continue
    files_scanned += 1
    try:
        text = p.read_text(encoding='utf-8')
    except Exception:
        continue
    lines = text.splitlines()
    for i, line in enumerate(lines, start=1):
        for m in t_pattern.finditer(line):
            key = m.group(1)
            usage.setdefault(key, []).append((str(p), i, line.strip()))
    # JSX text nodes (exclude lines that are mostly code)
    for m in jsx_text_pattern.finditer(text):
        content = m.group(1).strip()
        # ignore if empty, contains only punctuation/numbers, or is code-ish
        if content and re.search(r'[A-Za-z]', content) and not re.search(r'[{}<>]', content):
            # locate line
            pos = m.start()
            line_num = text[:pos].count('\n') + 1
            line_str = text.splitlines()[line_num-1].strip()
            jsx_texts.append((str(p), line_num, content[:80], line_str[:120]))
    # raw string literals that might be UI
    for m in str_literal_pattern.finditer(text):
        content = m.group(1)
        # skip import paths, comments, etc heuristically
        if 'http' in content or '@' in content or content.count(' ') > 8:
            continue
        pos = m.start()
        line_num = text[:pos].count('\n') + 1
        raw_strings.append((str(p), line_num, content[:80]))

print(f"Files scanned: {files_scanned}")
print(f"Unique t() keys: {len(usage)}")
print(f"Raw JSX text candidates: {len(jsx_texts)}")
print(f"Raw string literal candidates: {len(raw_strings)}")

# load en keys
import re
trans_file = Path('frontend/src/i18n/translations.ts')
trans_text = trans_file.read_text(encoding='utf-8')
en_keys = set(re.findall(r"^\s+'([^']+)':", trans_text, flags=re.MULTILINE))
ko_keys = set(re.findall(r"^\s+'([^']+)':", trans_text, flags=re.MULTILINE)) - en_keys
# ko keys are same set essentially; duplicates due to both files
all_keys = en_keys
used_keys = set(usage.keys())
unused = sorted(all_keys - used_keys)
missing = sorted(used_keys - all_keys)

print(f"Keys in translations.ts: {len(all_keys)}")
print(f"Unused keys: {len(unused)}")
print(f"Keys used but missing in translations: {len(missing)}")

out = {
    'files_scanned': files_scanned,
    'unique_keys': len(usage),
    'unused_keys': unused,
    'missing_keys': missing,
    'usage': {k: [list(x) for x in v] for k,v in usage.items()},
    'jsx_text_candidates': [list(x) for x in jsx_texts],
    'raw_string_candidates': [list(x) for x in raw_strings],
}
Path('.tmp/audit_translations.json').write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
print("Wrote .tmp/audit_translations.json")
