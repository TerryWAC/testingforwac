#!/usr/bin/env node
/* Build self-contained blocks for the Elementor "HTML" widget.
 *
 *   node build-elementor.js
 *
 * Outputs to dist/. Each file is a complete, paste-ready block: no <html>,
 * <head> or <body>, all CSS and JS inline, nothing loaded from this repo.
 *
 * Two things make a widget survive inside a WordPress theme:
 *
 *  1. CSS is scoped. Every selector is prefixed with .mfw, and :root / html /
 *     body are rewritten to .mfw, so the custom properties live on the wrapper
 *     instead of the document. Nothing leaks out into the theme, and the
 *     theme's own rules lose most specificity fights inside the widget.
 *
 *  2. JS is scoped. The selector helpers are re-rooted at the widget element,
 *     so a .field or #mf-price elsewhere on the page is invisible to it.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCOPE = '.mfw';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- CSS scoping ----------

   Walks balanced blocks rather than scanning character by character, which is
   what the first attempt got wrong: `:root` slipped through unscoped, so none
   of the custom properties landed on the wrapper and every var() resolved to
   nothing. */


// Selectors that mean "the whole page" and must become the wrapper instead.
function scopeOne(part) {
  part = part.trim();
  if (!part) return part;
  if (part.startsWith(SCOPE)) return part;

  // :root[data-theme="dark"] -> .mfw[data-theme="dark"] so the wrapper itself
  // carries the theme, and :root:not(...) likewise.
  let m = part.match(/^:root:not\((\[data-theme="[^"]+"\])\)(.*)$/);
  if (m) return SCOPE + ':not(' + m[1] + ')' + m[2];
  m = part.match(/^:root(\[[^\]]+\])(.*)$/);
  if (m) return SCOPE + m[1] + m[2];

  if (part === ':root' || part === 'html' || part === 'body') return SCOPE;

  // Leading html/body qualifiers are redundant once scoped.
  part = part.replace(/^(?:html|body)\s+/, '');

  if (part === '*') return SCOPE + ', ' + SCOPE + ' *';
  if (part === '*::before' || part === '*::after')
    return SCOPE + part.slice(1) + ', ' + SCOPE + ' ' + part;
  if (part.startsWith('::')) return SCOPE + ' ' + part;

  return SCOPE + ' ' + part;
}

function scopeSelectorList(sel) {
  return sel.split(',').map(scopeOne).filter(Boolean).join(', ');
}

function matchingBrace(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (!depth) return i; }
  }
  return css.length - 1;
}

// At-rules whose bodies contain rules that still need scoping.
const NESTS_RULES = /^@(media|supports|layer|container|scope)\b/i;
// At-rules whose bodies must be left completely alone.
const OPAQUE = /^@(keyframes|-\w+-keyframes|font-face|page|counter-style|property|font-feature-values)\b/i;

function scopeCss(css) {
  // Comments can contain braces; strip them first.
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  let out = '', i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace === -1) { out += css.slice(i); break; }

    const semi = css.indexOf(';', i);
    if (semi !== -1 && semi < brace) {          // statement at-rule, e.g. @import
      out += css.slice(i, semi + 1);
      i = semi + 1;
      continue;
    }

    const prelude = css.slice(i, brace).trim();
    const close = matchingBrace(css, brace);
    const body = css.slice(brace + 1, close);

    if (OPAQUE.test(prelude)) {
      // @font-face is dropped: the widget cannot serve files from this repo.
      if (!/^@font-face/i.test(prelude)) out += '\n' + prelude + ' {' + body + '}';
    } else if (NESTS_RULES.test(prelude)) {
      out += '\n' + prelude + ' {' + scopeCss(body) + '}';
    } else {
      out += '\n' + scopeSelectorList(prelude) + ' {' + body + '}';
    }
    i = close + 1;
  }
  return out;
}

/* ---------- JS scoping ----------

   Rewriting every `document.*` call with regexes was fragile and produced
   broken syntax. Instead the app script runs inside a closure where `document`
   is shadowed by a small shim: lookups are rooted at the widget, everything
   else passes straight through to the real document. app.js is embedded
   verbatim, so it cannot drift from the site. */

function jsWrapper(inner) {
  return `(function (global) {
  var realDoc = global.document;

  // Our own wrapper is the last .mfw in the document at the point this runs,
  // because the markup above has already parsed and anything later has not.
  var nodes = realDoc.querySelectorAll('.mfw');
  var MFROOT = nodes[nodes.length - 1] || realDoc;

  // Shadowing \`document\` scopes every lookup in the embedded script to the
  // widget, so an element with the same id elsewhere on the page is invisible
  // to it — and the widget is invisible to the theme's own scripts.
  var document = {
    getElementById: function (id) {
      return MFROOT.querySelector('#' + (global.CSS && CSS.escape ? CSS.escape(id) : id));
    },
    querySelector: function (s) { return MFROOT.querySelector(s); },
    querySelectorAll: function (s) { return MFROOT.querySelectorAll(s); },
    createElement: function (t) { return realDoc.createElement(t); },
    addEventListener: function () { return realDoc.addEventListener.apply(realDoc, arguments); },
    removeEventListener: function () { return realDoc.removeEventListener.apply(realDoc, arguments); },
    get documentElement() { return MFROOT; },
    get body() { return realDoc.body; },
    get referrer() { return realDoc.referrer; },
    get activeElement() { return realDoc.activeElement; }
  };

${inner}
})(window);`;
}

/* ---------- Section extraction ---------- */

function extractSection(html, id) {
  const marker = `id="${id}"`;
  const idx = html.indexOf(marker);
  if (idx === -1) throw new Error('section not found: ' + id);
  const start = html.lastIndexOf('<section', idx);
  // Walk to the matching </section>.
  let depth = 1, pos = html.indexOf('>', idx) + 1;
  const re = /<(\/?)section\b/g;
  re.lastIndex = pos;
  let m;
  while ((m = re.exec(html)) && depth) {
    depth += m[1] ? -1 : 1;
    if (!depth) return html.slice(start, html.indexOf('>', m.index) + 1);
  }
  throw new Error('unbalanced section: ' + id);
}

/* ---------- Build ---------- */

const css = read('assets/styles.css');
const js = read('assets/app.js');
const rates = read('assets/rates.js');
const home = read('index.html');

const scopedCss = scopeCss(css);


const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap">`;

function widget(name, innerHtml, opts) {
  opts = opts || {};
  return `<!-- ============================================================
     Mortgage Fixer — ${name}
     Paste this whole block into an Elementor "HTML" widget.

     Self-contained: all styles and behaviour are inline and scoped to
     .mfw, so it cannot affect the rest of your page and your theme
     cannot break it.

     Fonts: this loads Poppins from Google Fonts. If your site already
     loads Poppins, delete the three <link> tags below. If you need to
     avoid third-party requests for GDPR reasons, host the woff2 files
     yourself and swap the @font-face in (see site/assets/fonts/).
     ============================================================ -->

${FONT}

<div class="mfw">
${innerHtml}
</div>

<style>
/* Defensive reset: WordPress themes style these aggressively. Scoped so it
   only applies inside the widget. */
.mfw, .mfw * { box-sizing: border-box; }
.mfw p, .mfw ul, .mfw ol, .mfw li, .mfw h1, .mfw h2, .mfw h3, .mfw h4,
.mfw fieldset, .mfw legend, .mfw figure, .mfw blockquote { margin: 0; padding: 0; }
.mfw ul, .mfw ol { list-style: none; }
.mfw button, .mfw input, .mfw select, .mfw textarea {
  font-family: inherit !important;   /* themes commonly force a font here with !important */
  font-size: inherit; font-weight: inherit; line-height: inherit;
  color: inherit; margin: 0; letter-spacing: normal; text-transform: none;
}
/* The site relies on headings inheriting colour, so a theme that colours them
   directly wins. Reassert inheritance; the site's own dark-section rules are
   more specific and still override this. */
.mfw h1, .mfw h2, .mfw h3, .mfw h4, .mfw legend {
  text-transform: none; font-family: inherit; color: inherit;
  letter-spacing: inherit;
}
/* Themes frequently force link colour with !important. */
.mfw a:not(.btn) { color: var(--accent) !important; text-decoration-thickness: auto; }
.mfw .results a, .mfw .reminder a, .mfw .cta-band a, .mfw .article__cta a,
.mfw .hero a:not(.btn) { color: var(--text-inverse) !important; }
.mfw .btn { text-decoration: none !important; }
.mfw .btn { all: revert; }          /* undo a theme resetting buttons with all:unset */
.mfw a { box-shadow: none; }
.mfw input, .mfw select, .mfw textarea {
  border-style: solid !important; border-width: 1px !important; border-radius: 6px;
  background-image: none; box-shadow: none;
}
.mfw .input-affix input, .mfw .input-affix select { border: 0 !important; }
.mfw img { max-width: 100%; height: auto; }
.mfw .section { padding-block: 0; }
.mfw .wrap { padding-inline: 0; max-width: none; }

${scopedCss}
</style>

<script>
${jsWrapper((opts.rates ? rates : '') + '\n' + js)}
</script>
`;
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

const calculators = extractSection(home, 'calculators');
const contact = extractSection(home, 'contact');
const reminder = home.slice(home.indexOf('<div class="reminder" id="rate-reminder">'),
  home.indexOf('</div>', home.indexOf('reminder__note')) + 6) + '\n      </div>';

const builds = [
  ['elementor-calculators.html', 'Calculators', calculators, { rates: true }],
  ['elementor-enquiry-form.html', 'Enquiry form', contact, {}],
  ['elementor-rate-reminder.html', 'Rate-expiry reminder', '<section class="section">\n<div class="wrap">\n' + reminder + '\n</div>\n</section>', {}],
  ['elementor-everything.html', 'Calculators, enquiry form and reminder',
    calculators + '\n' + contact + '\n<section class="section"><div class="wrap">' + reminder + '</div></section>', { rates: true }]
];

builds.forEach(([file, name, html, opts]) => {
  fs.writeFileSync(path.join(ROOT, 'dist', file), widget(name, html, opts));
  const kb = (fs.statSync(path.join(ROOT, 'dist', file)).size / 1024).toFixed(0);
  console.log(`  dist/${file.padEnd(32)} ${kb} KB`);
});
console.log('\nPaste any of these into an Elementor HTML widget.');
