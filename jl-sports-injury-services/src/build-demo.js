#!/usr/bin/env node
/**
 * Single-file demo build.
 *
 *   node src/build-demo.js
 *
 * Packs the whole site — every page, the CSS, the fonts and the booking flow —
 * into one self-contained HTML file with hash routing, so it can be handed to
 * the client as a link with nothing to install or deploy.
 *
 * This is a delivery convenience only. `site/` remains the real website: real
 * URLs, real per-page metadata, real sitemap.
 */

const fs = require('fs');
const path = require('path');

const { header, footer, themeBoot } = require('./layout');
const { pages } = require('./pages');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');

// ---------------------------------------------------------------------------
// Fonts → data URIs (the demo host blocks every external request)
// ---------------------------------------------------------------------------

const fontFace = (family, file, weights) => {
  const b64 = fs.readFileSync(path.join(SITE, 'assets/fonts', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weights};font-display:swap;
src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
};

const fonts =
  fontFace('Outfit', 'outfit-latin.woff2', '200 800') +
  fontFace('Inter', 'inter-latin.woff2', '300 700');

// ---------------------------------------------------------------------------
// Photographs → data URIs
//
// Same reason as the fonts: the demo is one file with no server behind it and
// a host that blocks every external request, so a relative src fetches
// nothing. Without this the photographs are simply absent from the demo — and
// silently, because the branded backdrop behind each one covers the gap.
//
// Only images actually referenced get inlined, so the Open Graph share images
// (~120 kB each, and meaningless in a single-file demo) stay out of it.
// ---------------------------------------------------------------------------

const IMG_MIME = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

const inlinedImages = new Map();

function inlineImages(markup) {
  return markup.replace(/(src|href)="assets\/img\/([^"]+)"/g, (whole, attr, file) => {
    const abs = path.join(SITE, 'assets/img', file);
    if (!fs.existsSync(abs)) return whole;
    const mime = IMG_MIME[path.extname(file).toLowerCase()];
    if (!mime) return whole;
    if (!inlinedImages.has(file)) {
      inlinedImages.set(file, fs.readFileSync(abs).toString('base64'));
    }
    return `${attr}="data:${mime};base64,${inlinedImages.get(file)}"`;
  });
}

// ---------------------------------------------------------------------------
// Page bodies
// ---------------------------------------------------------------------------

const all = pages().filter((p) => p.slug !== '404.html');
const slugOf = (file) => file.replace('.html', '');

/** Rewrite one page body so it can coexist with thirteen others in one DOM. */
function prepare(p) {
  const key = slugOf(p.slug);
  let html = p.body;

  // Namespace the ids that repeat across pages (FAQ blocks appear twice).
  html = html
    .replace(/id="faqs"/g, `id="${key}-faqs"`)
    .replace(/id="faq-([pb])-(\d+)"/g, `id="${key}-faq-$1-$2"`)
    .replace(/aria-controls="faq-p-(\d+)"/g, `aria-controls="${key}-faq-p-$1"`)
    .replace(/aria-labelledby="faq-b-(\d+)"/g, `aria-labelledby="${key}-faq-b-$1"`);

  // The .ics download works on the real site but the demo host blocks
  // page-initiated downloads, so drop the control rather than show a dead one.
  html = html.replace(/<a[^>]*data-ics[^>]*>[\s\S]*?<\/a>/g, '');

  // Internal links become routes.
  html = html.replace(/href="([a-z0-9-]+)\.html(\?[^"]*)?(#[^"]*)?"/g, (m, file, query, anchor) => {
    const route = `#/${slugOf(file + '.html')}${query || ''}`;
    return anchor
      ? `href="${route}" data-scroll="${anchor.slice(1)}"`
      : `href="${route}"`;
  });

  return `<div class="demo-page" data-route="${key}" hidden>${inlineImages(html)}</div>`;
}

const bodies = all.map(prepare).join('\n');

// The shared chrome, with the same link rewriting applied.
const chrome = (markup) =>
  inlineImages(
    markup.replace(/href="([a-z0-9-]+)\.html(\?[^"]*)?(#[^"]*)?"/g, (m, file, query, anchor) => {
      const route = `#/${slugOf(file + '.html')}${query || ''}`;
      return anchor ? `href="${route}" data-scroll="${anchor.slice(1)}"` : `href="${route}"`;
    })
  );


// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = `
(function () {
  var pages = Array.prototype.slice.call(document.querySelectorAll('.demo-page'));
  var home = 'index';

  function parse() {
    var h = location.hash.replace(/^#\\/?/, '');
    if (!h) return { route: home, query: '' };
    var q = h.indexOf('?');
    return q === -1
      ? { route: h, query: '' }
      : { route: h.slice(0, q), query: h.slice(q + 1) };
  }

  function markActive(route) {
    document.querySelectorAll('.nav-link, .mega-item, .mobile-list a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var target = href.replace(/^#\\//, '').split('?')[0];
      var on = target === route || (route !== home && target === route);
      a.classList.toggle('is-active', on);
      if (a.matches('.mobile-list > li > a')) {
        on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
      }
    });
  }

  function show(scrollTo) {
    var s = parse();
    var found = false;

    pages.forEach(function (p) {
      var on = p.getAttribute('data-route') === s.route;
      p.hidden = !on;
      if (on) found = true;
    });

    if (!found) {
      pages.forEach(function (p) { p.hidden = p.getAttribute('data-route') !== home; });
      s.route = home;
    }

    markActive(s.route);

    // Re-run the reveal pass for whichever page just appeared.
    document.querySelectorAll('.demo-page:not([hidden]) [data-reveal]').forEach(function (el) {
      el.classList.add('is-in');
    });

    // Treatment deep links behave exactly as they do on the real site.
    if (s.route === 'book' && s.query) {
      var m = /treatment=([a-z-]+)/.exec(s.query);
      if (m) {
        var input = document.querySelector('input[name="treatment"][value="' + m[1] + '"]');
        if (input && !input.checked) {
          input.checked = true;
          input.dispatchEvent(new Event('change'));
        }
      }
    }

    if (scrollTo) {
      var el = document.getElementById(scrollTo);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-scroll]');
    if (a) window.__demoScroll = a.getAttribute('data-scroll');
  });

  window.addEventListener('hashchange', function () {
    var s = window.__demoScroll;
    window.__demoScroll = null;
    show(s);
  });

  show(null);
})();
`;

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const out = `<title>J.L. Sports Injury Services</title>
<script>${themeBoot}</script>
<style>
${fonts}
${read('assets/css/site.css')}

/* Demo shell: the pages share one document, so only one is ever visible. */
.demo-page[hidden] { display: none; }
</style>

${chrome(header('index.html'))}
<main id="main">
${bodies}
</main>
${chrome(footer())}

<script>${read('assets/js/site.js')}</script>
<script>${read('assets/js/booking.js')}</script>
<script>${router}</script>
`;

const file = path.join(ROOT, 'demo.html');
fs.writeFileSync(file, out);
console.log(`  demo.html — ${(out.length / 1024).toFixed(0)} kB, ${all.length} pages inlined`);
console.log(`  ${file}\n`);
