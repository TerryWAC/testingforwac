/**
 * Pre-delivery audit: accessibility, responsive behaviour and page weight.
 *
 *   node src/audit.js
 *
 * Separate from verify.js, which covers functionality. This one asks whether
 * the site is fit to hand to a client and put in front of the public.
 */

const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8899';
const THEME = process.env.THEME || '';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const PAGES = [
  'index.html', 'about-us.html', 'services.html', 'injury-assessment.html',
  'sports-massage.html', 'deep-tissue-massage.html', 'follow-up-treatment.html',
  'medical-acupuncture.html', 'electrotherapy.html', 'ultrasound-therapy.html',
  'conditions.html', 'knee-pain.html', 'back-pain.html', 'neck-pain.html',
  'sciatica-nerve-pain.html', 'muscle-strains.html', 'shoulder-pain.html',
  'wrist-elbow-pain.html',
  'price-list.html', 'reviews.html', 'offers.html', 'gift-vouchers.html',
  'first-visit.html', 'faqs.html',
  'book.html', 'contact.html', 'privacy-policy.html', '404.html',
];

const WIDTHS = [360, 390, 768, 1024, 1280, 1440, 1920];

// ---------------------------------------------------------------------------
// In-page audit (runs inside the browser)
// ---------------------------------------------------------------------------

const AUDIT = () => {
  // Whatever <body> actually paints is the ground everything composites onto.
  const bodyBg = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
  window.__auditGround = bodyBg ? bodyBg.slice(0, 3).map(Number) : [6, 16, 12];
  const out = [];

  // --- colour contrast ----------------------------------------------------
  const srgb = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((n) => parseFloat(n));
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

  // A gradient paints a real background even though backgroundColor is
  // transparent. Take its darkest stop — the worst case for light text, and
  // the closest thing to a single representative colour.
  const gradientStop = (cs) => {
    const img = cs.backgroundImage;
    if (!img || img === 'none' || !/gradient/.test(img)) return null;
    const stops = img.match(/rgba?\([^)]+\)/g);
    if (!stops) return null;
    const parsed = stops.map(parse).filter((c) => c && c.a > 0.5);
    if (!parsed.length) return null;
    return parsed.reduce((a, b) => (lum(a.rgb) < lum(b.rgb) ? a : b));
  };

  // Effective background: walk up compositing translucent layers onto the root.
  const bgOf = (el) => {
    let node = el;
    const stack = [];
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a === 1) break;
      }
      const g = gradientStop(cs);
      if (g) {
        stack.push({ rgb: g.rgb, a: 1 });
        break;
      }
      node = node.parentElement;
    }
    let base = window.__auditGround || [6, 16, 12]; // the page ground
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i].rgb, base, stack[i].a);
    return base;
  };

  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const hasOwnText = (el) =>
    Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);

  document.querySelectorAll('body *').forEach((el) => {
    if (!hasOwnText(el)) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.6) return;
    // Gradient-clipped text has no measurable colour.
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)') return;

    const fg = parse(cs.color);
    if (!fg) return;
    const bg = bgOf(el);
    const colour = fg.a < 1 ? over(fg.rgb, bg, fg.a) : fg.rgb;
    const r = ratio(colour, bg);

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;

    if (r < need) {
      out.push(
        `contrast ${r.toFixed(2)}:1 (needs ${need}) — ${el.tagName.toLowerCase()}.${
          el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : ''
        } "${el.textContent.trim().slice(0, 45)}"`
      );
    }
  });

  // --- images -------------------------------------------------------------
  document.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('alt')) out.push(`img without alt: ${img.getAttribute('src')}`);
  });

  // --- form controls ------------------------------------------------------
  document.querySelectorAll('input, select, textarea').forEach((f) => {
    if (f.type === 'hidden') return;
    const labelled =
      (f.id && document.querySelector(`label[for="${f.id}"]`)) ||
      f.closest('label') ||
      f.getAttribute('aria-label') ||
      f.getAttribute('aria-labelledby');
    if (!labelled) out.push(`unlabelled control: ${f.name || f.type}`);
  });

  // --- links and buttons --------------------------------------------------
  document.querySelectorAll('a[href], button').forEach((el) => {
    const name = (el.textContent || '').trim() || el.getAttribute('aria-label') || '';
    if (!name) out.push(`${el.tagName.toLowerCase()} with no accessible name: ${el.outerHTML.slice(0, 70)}`);
    if (/^(click here|read more|here|link)$/i.test(name)) out.push(`vague link text: "${name}"`);
  });

  // --- heading order ------------------------------------------------------
  const levels = Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4'))
    .map((h) => parseInt(h.tagName[1], 10));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) out.push(`heading level jumps h${levels[i - 1]} → h${levels[i]}`);
  }

  // --- landmarks and document ---------------------------------------------
  if (!document.querySelector('main')) out.push('no <main> landmark');
  if (!document.querySelector('header')) out.push('no <header> landmark');
  if (!document.querySelector('footer')) out.push('no <footer> landmark');
  if (!document.documentElement.lang) out.push('no lang attribute');

  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(vp.content)) {
    out.push('viewport blocks zooming');
  }

  // --- duplicate ids ------------------------------------------------------
  const seen = {};
  document.querySelectorAll('[id]').forEach((el) => {
    seen[el.id] = (seen[el.id] || 0) + 1;
    if (seen[el.id] === 2) out.push(`duplicate id: ${el.id}`);
  });

  return out;
};


/**
 * Apply a theme and block until it has actually landed.
 *
 * Two traps here, both of which silently produce a wrong answer rather than an
 * error. addInitScript runs before <html> exists, so setting the attribute
 * there does nothing at all. And most elements carry a colour transition, so
 * measuring straight after the switch samples a half-faded value — which reads
 * as hundreds of contrast failures that do not exist. Kill motion first, then
 * switch, then wait for the tokens to confirm.
 */
async function applyTheme(page) {
  if (!THEME) return;
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), THEME);
  await page.waitForFunction(
    (t) => document.documentElement.getAttribute('data-theme') === t,
    THEME,
    { timeout: 5000 }
  );
}

// ---------------------------------------------------------------------------

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const problems = [];
  const weights = [];

  // --- accessibility, one pass per page ------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();

  for (const p of PAGES) {
    let bytes = 0;
    let requests = 0;
    const onResponse = async (r) => {
      requests++;
      try {
        const len = (await r.allHeaders())['content-length'];
        if (len) bytes += parseInt(len, 10);
      } catch (e) { /* response already gone */ }
    };
    page.on('response', onResponse);

    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
    await applyTheme(page);
    const found = await page.evaluate(AUDIT);
    found.forEach((f) => problems.push(`${p} :: ${f}`));

    const nodes = await page.evaluate(() => document.querySelectorAll('*').length);
    weights.push({ page: p, kb: Math.round(bytes / 1024), requests, nodes });
    page.off('response', onResponse);
  }

  // --- touch targets on mobile ---------------------------------------------
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });

  const mp = await mctx.newPage();
  for (const p of ['index.html', 'book.html', 'contact.html', 'services.html']) {
    await mp.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
    await applyTheme(mp);
    const small = await mp.evaluate(() => {
      const bad = [];
      document.querySelectorAll('a[href], button, input[type="radio"] + *').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // Inline links inside running text are exempt — the rule targets controls.
        if (el.tagName === 'A' && el.closest('p, label, .crumbs, .footer-col, address')) return;
        // Card-stretch links are as big as their card, not their own box.
        if (el.closest('.card-stretch h3')) return;
        if (r.height < 32 || r.width < 32) {
          bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)}`);
        }
      });
      return [...new Set(bad)];
    });
    small.forEach((s) => problems.push(`${p} :: small touch target — ${s}`));
  }

  // --- layout across widths -------------------------------------------------
  for (const w of WIDTHS) {
    const c = await browser.newContext({ viewport: { width: w, height: 900 } });

    const pg = await c.newPage();
    for (const p of PAGES) {
      await pg.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded' });
      // Raw scrollWidth over-reports (scrollbars, mobile layout viewport), so
      // test what actually matters: can the page be scrolled sideways, and is
      // any element sticking out that is not clipped by an ancestor?
      const bad = await pg.evaluate(() => {
        const docW = document.documentElement.clientWidth;

        const clipped = (el) => {
          let n = el.parentElement;
          while (n) {
            if (/hidden|clip|auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
            n = n.parentElement;
          }
          return false;
        };

        const wide = [];
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || getComputedStyle(el).position === 'fixed') return;
          if (r.right > docW + 1 && !clipped(el)) {
            wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} (+${Math.round(r.right - docW)}px)`);
          }
        });

        const before = window.scrollX;
        window.scrollTo(400, window.scrollY);
        const scrolled = window.scrollX > 0;
        window.scrollTo(before, window.scrollY);

        return { scrolled, wide: [...new Set(wide)].slice(0, 4) };
      });
      if (bad.scrolled || bad.wide.length) {
        problems.push(`${p} @${w}px :: horizontal overflow — ${bad.wide.join(', ') || 'page scrolls sideways'}`);
      }
    }
    await c.close();
  }

  await browser.close();

  // --- report ---------------------------------------------------------------
  console.log('\n=== PAGE WEIGHT ===');
  weights.forEach((w) =>
    console.log(`  ${w.page.padEnd(26)} ${String(w.kb).padStart(4)} kB  ${String(w.requests).padStart(2)} requests  ${String(w.nodes).padStart(4)} nodes`)
  );
  const heaviest = weights.reduce((a, b) => (b.kb > a.kb ? b : a));
  console.log(`  heaviest: ${heaviest.page} at ${heaviest.kb} kB`);

  console.log(`\n=== AUDIT${THEME ? ' — ' + THEME + ' theme' : ''} ===`);
  const unique = [...new Set(problems)];
  if (!unique.length) console.log('No accessibility, layout or weight problems found.');
  else {
    console.log(`${unique.length} problem(s):`);
    unique.forEach((p) => console.log(' - ' + p));
  }
  process.exit(unique.length ? 1 : 0);
})();
