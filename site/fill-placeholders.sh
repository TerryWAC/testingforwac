#!/usr/bin/env bash
# Substitute the values in config.json into the site files.
#
# Safe to run repeatedly: the first run snapshots pristine copies into
# .templates/, and every run starts from those. Change a value in config.json
# and re-run — you never end up with half-substituted files.

set -euo pipefail
cd "$(dirname "$0")"

FILES=(index.html privacy.html 404.html robots.txt sitemap.xml
  guides/index.html guides/how-much-deposit.html guides/when-to-remortgage.html
  guides/self-employed-mortgages.html)

if [ ! -d .templates ]; then
  mkdir -p .templates
  mkdir -p .templates/guides
  for f in "${FILES[@]}"; do [ -f "$f" ] && cp "$f" ".templates/$f"; done
  echo "Snapshotted pristine templates into .templates/"
fi

command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }

python3 - "${FILES[@]}" <<'PY'
import json, sys, pathlib, re

cfg = json.load(open('config.json'))
cfg = {k: v for k, v in cfg.items() if not k.startswith('_')}

REGULATORY = ['FIRM LEGAL NAME', 'NETWORK NAME', 'FRN', 'COMPANY NUMBER', 'FEE WORDING']
CLAIMS = ['MORTGAGES ARRANGED', 'LENDING SECURED', 'REVIEW SCORE']

blank = [k for k, v in cfg.items() if not str(v).strip()]
filled = {k: v for k, v in cfg.items() if str(v).strip()}


def clean_marks(text):
    """Drop the amber "unfinished" underline once an element's tokens resolve.

    class="placeholder" is authored into the markup, so without this the FCA
    disclosure keeps a dotted amber underline on a live client-facing footer
    even after the details are filled in."""
    out, pos = [], 0
    pattern = re.compile(r'<(\w+)([^>]*\bclass="([^"]*\bplaceholder\b[^"]*)"[^>]*)>')
    while True:
        m = pattern.search(text, pos)
        if not m:
            out.append(text[pos:])
            break
        tag = m.group(1)
        # Find the element's matching close tag so we can inspect its contents.
        depth, scan = 1, m.end()
        closer = re.compile(r'<(/?)' + tag + r'(?:\s[^>]*)?>', re.I)
        while depth and scan < len(text):
            nxt = closer.search(text, scan)
            if not nxt:
                break
            depth += -1 if nxt.group(1) else 1
            scan = nxt.end()
        inner = text[m.end():scan]
        out.append(text[pos:m.start()])
        if re.search(r'\[[A-Z][A-Z0-9 _/&-]{2,}\]', inner):
            out.append(m.group(0))          # still unresolved — keep the marker
        else:
            classes = [c for c in m.group(3).split() if c != 'placeholder']
            attrs = m.group(2)
            if classes:
                attrs = attrs.replace('class="' + m.group(3) + '"', 'class="' + ' '.join(classes) + '"')
            else:
                attrs = re.sub(r'\s*class="[^"]*"', '', attrs)
            out.append('<' + tag + attrs + '>')
        pos = m.end()
    return ''.join(out)


def strip_editor_notes(text):
    """Remove <!-- EDITOR ... --> comments from the served output.

    They are guidance for whoever maintains the site, not something a client
    should find in view-source on a live page."""
    return re.sub(r'\n?[ \t]*<!--\s*EDITOR[\s\S]*?-->', '', text)


def drop_optional(text, missing):
    """Remove any element marked data-needs="X" where X was not supplied.

    Walks forward from the opening tag counting same-name opens and closes, so
    nested markup is removed cleanly rather than by a naive regex."""
    for key in missing:
        while True:
            m = re.search(r'<(\w+)([^>]*\bdata-needs="' + re.escape(key) + r'"[^>]*)>', text)
            if not m:
                break
            tag, start = m.group(1), m.start()
            # Self-closing or void element: drop the tag alone.
            if m.group(0).rstrip().endswith('/>'):
                text = text[:start] + text[m.end():]
                continue
            depth, pos = 1, m.end()
            pattern = re.compile(r'<(/?)' + tag + r'(?:\s[^>]*)?>', re.I)
            while depth and pos < len(text):
                nxt = pattern.search(text, pos)
                if not nxt:
                    break
                depth += -1 if nxt.group(1) else 1
                pos = nxt.end()
            text = text[:start] + text[pos:]
    return text


for name in sys.argv[1:]:
    src = pathlib.Path('.templates') / name
    if not src.exists():
        continue
    text = src.read_text()
    text = drop_optional(text, blank)
    for key, val in filled.items():
        text = text.replace('[' + key + ']', str(val))
    text = clean_marks(text)
    text = strip_editor_notes(text)
    pathlib.Path(name).write_text(text)

print("Substituted %d value(s) into %d file(s)." % (len(filled), len(sys.argv) - 1))

dropped = [k for k in blank if k not in REGULATORY]
if dropped:
    print("\nNot supplied, so removed from the page entirely:")
    for k in dropped:
        print("  - " + k)
    print("  The site still reads as finished. Add them to config.json and re-run at any time.")

remaining = set()
for name in sys.argv[1:]:
    p = pathlib.Path(name)
    if p.exists():
        remaining.update(re.findall(r'\[[A-Z][A-Z0-9 _/&-]{2,}\]', p.read_text()))

reg_left = [k for k in REGULATORY if k in blank]
if reg_left:
    print("\n" + "!" * 62)
    print("NOT READY TO PUBLISH — regulatory details still missing:")
    for k in reg_left:
        print("  - " + k)
    print("These appear in the footer and privacy notice and cannot be guessed.")
    print("Ask Sam, or his network's compliance team. See HANDOVER.md.")
    print("!" * 62)

claims_left = sorted(c for c in CLAIMS if '[' + c + ']' in "".join(
    pathlib.Path(n).read_text() for n in sys.argv[1:] if pathlib.Path(n).exists()))
if claims_left:
    print("\nPublic claims still to write by hand: " + ", ".join(claims_left))

if not reg_left and not claims_left:
    print("\nNo blockers. Ready to publish.")
PY
