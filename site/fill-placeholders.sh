#!/usr/bin/env bash
# Substitute the values in config.json into the site files.
#
# Safe to run repeatedly: the first run snapshots pristine copies into
# .templates/, and every run starts from those. Change a value in config.json
# and re-run — you never end up with half-substituted files.

set -euo pipefail
cd "$(dirname "$0")"

FILES=(index.html privacy.html 404.html robots.txt sitemap.xml)

if [ ! -d .templates ]; then
  mkdir -p .templates
  for f in "${FILES[@]}"; do [ -f "$f" ] && cp "$f" ".templates/$f"; done
  echo "Snapshotted pristine templates into .templates/"
fi

command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }

python3 - "${FILES[@]}" <<'PY'
import json, sys, pathlib, re

cfg = json.load(open('config.json'))
cfg = {k: v for k, v in cfg.items() if not k.startswith('_')}

blank = [k for k, v in cfg.items() if not str(v).strip()]
filled = {k: v for k, v in cfg.items() if str(v).strip()}

for name in sys.argv[1:]:
    src = pathlib.Path('.templates') / name
    if not src.exists():
        continue
    text = src.read_text()
    for key, val in filled.items():
        text = text.replace('[' + key + ']', str(val))
    pathlib.Path(name).write_text(text)

print("Substituted %d value(s) into %d file(s)." % (len(filled), len(sys.argv) - 1))

if blank:
    print("\nStill empty in config.json (left as [PLACEHOLDER] on the page):")
    for k in blank:
        print("  - " + k)

remaining = set()
for name in sys.argv[1:]:
    p = pathlib.Path(name)
    if p.exists():
        remaining.update(re.findall(r'\[[A-Z][A-Z0-9 _/&-]{2,}\]', p.read_text()))
if remaining:
    print("\nPlaceholders still present in the built files:")
    for r in sorted(remaining):
        print("  " + r)
    print("\nNote: reviews, stats and the compliance/fee wording are prose, not")
    print("simple tokens — edit those by hand. See README.md.")
else:
    print("\nNo bracketed placeholders remain.")
PY
