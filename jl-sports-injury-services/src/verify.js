/**
 * Browser check: loads every page, captures console/network errors, walks the
 * booking flow end to end, and writes screenshots for review.
 *
 *   node src/verify.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8899';
const SHOTS = path.join(__dirname, '..', 'screenshots');

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

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const problems = [];

  // -- every page, desktop -------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[console] ${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${page.url()} :: ${e.message}`));
  page.on('requestfailed', (r) => {
    problems.push(`[404/net] ${r.url()} :: ${r.failure() && r.failure().errorText}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`);
  });

  for (const p of PAGES) {
    await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });

    // Sanity: exactly one h1, a title, a description.
    const h1s = await page.locator('h1').count();
    if (h1s !== 1) problems.push(`[seo] ${p} has ${h1s} <h1>`);
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    if (!desc || desc.length < 70) problems.push(`[seo] ${p} description too short`);
    if (desc && desc.length > 165) problems.push(`[seo] ${p} description ${desc.length} chars (>165)`);
    const title = await page.title();
    if (title.length > 65) problems.push(`[seo] ${p} title ${title.length} chars: ${title}`);

    // Horizontal overflow check.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    if (overflow) problems.push(`[layout] ${p} scrolls horizontally at 1440px`);

    await page.screenshot({ path: path.join(SHOTS, `desktop-${p.replace('.html', '')}.png`), fullPage: false });
  }

  // -- mobile spot checks --------------------------------------------------
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => problems.push(`[mobile pageerror] ${mp.url()} :: ${e.message}`));

  for (const p of ['index.html', 'services.html', 'book.html', 'contact.html']) {
    await mp.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
    const overflow = await mp.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    if (overflow) problems.push(`[layout] ${p} scrolls horizontally at 390px`);
    await mp.screenshot({ path: path.join(SHOTS, `mobile-${p.replace('.html', '')}.png`), fullPage: false });
  }

  // Mobile menu opens.
  await mp.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await mp.click('.nav-toggle');
  await mp.waitForTimeout(600);
  const menuOpen = await mp.locator('.mobile-nav.is-open').count();
  if (!menuOpen) problems.push('[nav] mobile menu did not open');
  await mp.screenshot({ path: path.join(SHOTS, 'mobile-menu.png') });

  // -- booking flow, end to end -------------------------------------------
  await page.goto(`${BASE}/book.html`, { waitUntil: 'networkidle' });

  await page.click('input[name="treatment"][value="sports-massage"]', { force: true });
  await page.click('[data-next="0"]');
  await page.waitForTimeout(400);

  const durCount = await page.locator('#duration-options .opt').count();
  if (durCount !== 2) problems.push(`[booking] expected 2 duration options, got ${durCount}`);
  // Select by value, not position — the options are re-rendered when the
  // treatment changes, so an index can race the rebuild.
  await page.click('#duration-options input[value="60"]', { force: true });
  await page.click('[data-next="1"]');
  await page.waitForTimeout(400);

  const dayCount = await page.locator('#day-options .opt').count();
  if (dayCount !== 12) problems.push(`[booking] expected 12 day options, got ${dayCount}`);
  // Every offered day must be Mon–Thu.
  const dows = await page.locator('#day-options .dow').allTextContents();
  const bad = dows.filter((d) => !['Mon', 'Tue', 'Wed', 'Thu'].includes(d));
  if (bad.length) problems.push(`[booking] non-opening days offered: ${bad.join(', ')}`);

  await page.click('#day-options .opt:first-child input', { force: true });
  await page.click('[data-next="2"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'booking-date.png') });

  const timeCount = await page.locator('#time-options .opt').count();
  // 60-min appointment, 09:00–20:00, 30-min steps → 09:00 … 19:00 = 21 slots.
  if (timeCount !== 21) problems.push(`[booking] expected 21 time slots for 60min, got ${timeCount}`);
  const times = await page.locator('#time-options .opt-face').allTextContents();
  if (times[0] !== '09:00') problems.push(`[booking] first slot is ${times[0]}, expected 09:00`);
  if (times[times.length - 1] !== '19:00') {
    problems.push(`[booking] last slot is ${times[times.length - 1]}, expected 19:00`);
  }

  await page.click('#time-options .opt:nth-child(3) input', { force: true });
  await page.click('[data-next="3"]');
  await page.waitForTimeout(400);

  // Validation must block an empty form.
  await page.click('[data-next="4"]');
  await page.waitForTimeout(300);
  const blocked = await page.locator('#step-details.is-active').count();
  if (!blocked) problems.push('[booking] empty details form was NOT blocked by validation');
  const errors = await page.locator('.has-error').count();
  if (errors < 3) problems.push(`[booking] expected >=3 field errors, got ${errors}`);
  await page.screenshot({ path: path.join(SHOTS, 'booking-validation.png') });

  await page.fill('#bk-name', 'Alex Morgan');
  await page.fill('#bk-phone', '07700 900123');
  await page.fill('#bk-email', 'alex@example.com');
  await page.fill('#bk-notes', 'Tight right hamstring after a 10k, three weeks now.');
  await page.check('input[name="consent"]');
  await page.screenshot({ path: path.join(SHOTS, 'booking-details.png') });

  await page.click('[data-next="4"]');
  await page.waitForTimeout(700);

  const done = await page.locator('#step-done.is-active').count();
  if (!done) problems.push('[booking] confirmation step did not show');

  const summary = await page.locator('#step-done [data-sum="treatment"]').textContent();
  if (summary !== 'Sports Massage') problems.push(`[booking] summary treatment = "${summary}"`);
  const sumPrice = await page.locator('#step-done [data-sum="price"]').textContent();
  if (sumPrice !== '£50') problems.push(`[booking] summary price = "${sumPrice}", expected £50`);
  const sumWhen = await page.locator('#step-done [data-sum="when"]').textContent();
  if (!/\d/.test(sumWhen)) problems.push(`[booking] summary when = "${sumWhen}"`);

  const mailto = await page.locator('[data-mailto]').getAttribute('href');
  if (!mailto || !mailto.startsWith('mailto:')) problems.push('[booking] mailto handoff not built');
  if (mailto && !mailto.includes('Alex%20Morgan')) problems.push('[booking] mailto missing customer name');
  const fresha = await page.locator('[data-fresha]').getAttribute('href');
  if (!fresha || !fresha.includes('fresha.com')) problems.push('[booking] Fresha handoff missing');
  const ics = await page.locator('[data-ics]').getAttribute('href');
  if (!ics || !ics.startsWith('blob:')) problems.push('[booking] .ics file not generated');

  await page.screenshot({ path: path.join(SHOTS, 'booking-done.png') });

  // Deep link preselect.
  await page.goto(`${BASE}/book.html?treatment=medical-acupuncture`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const checked = await page.locator('input[name="treatment"]:checked').getAttribute('value');
  if (checked !== 'medical-acupuncture') problems.push(`[booking] deep link preselect failed (${checked})`);

  // -- FAQ accordion -------------------------------------------------------
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.locator('#faqs').scrollIntoViewIfNeeded();
  await page.click('.faq-item:first-child .faq-q');
  await page.waitForTimeout(500);
  const faqOpen = await page.locator('.faq-item:first-child.is-open').count();
  if (!faqOpen) problems.push('[faq] accordion did not open');

  // -- body map ------------------------------------------------------------
  //
  // Both routes in have to work: the figure for pointer users, the chips for
  // everyone else. They drive the same state, so check they agree.
  await page.locator('#where-does-it-hurt').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const hintFirst = await page.locator('[data-bm-hint]').isVisible();
  if (!hintFirst) problems.push('[bodymap] hint not shown before a choice is made');

  // force: the figure tilts towards the pointer by design, so Playwright's
  // "element is stable" check can never settle on a region under the cursor.
  await page.locator('.bm-region[data-region="knee-r"]').click({ force: true });
  await page.waitForTimeout(400);

  // Both knees light, and only the knees.
  const lit = await page.$$eval('.bm-region.is-on', (els) =>
    els.map((e) => e.getAttribute('data-region')).sort()
  );
  if (lit.join(',') !== 'knee-l,knee-r') {
    problems.push(`[bodymap] clicking a knee lit "${lit.join(',')}"`);
  }
  const panelOpen = await page.locator('.bm-panel[data-panel="knee-pain"]').isVisible();
  if (!panelOpen) problems.push('[bodymap] knee panel did not open');
  if (await page.locator('[data-bm-hint]').isVisible()) {
    problems.push('[bodymap] hint still showing after a choice');
  }
  const pressed = await page.$$eval('.bm-pick[aria-pressed="true"]', (els) => els.length);
  if (pressed !== 1) problems.push(`[bodymap] ${pressed} chips marked pressed, expected 1`);

  // Switching via the keyboard-accessible chips must move the heat with it.
  await page.click('.bm-pick[data-condition="back-pain"]');
  await page.waitForTimeout(400);
  const lit2 = await page.$$eval('.bm-region.is-on', (els) =>
    els.map((e) => e.getAttribute('data-region'))
  );
  if (lit2.join(',') !== 'back') problems.push(`[bodymap] chip lit "${lit2.join(',')}"`);
  if (!(await page.locator('.bm-panel[data-panel="back-pain"]').isVisible())) {
    problems.push('[bodymap] chip did not open the matching panel');
  }
  const stillOpen = await page.$$eval('.bm-panel:not([hidden])', (els) => els.length);
  if (stillOpen !== 1) problems.push(`[bodymap] ${stillOpen} panels open at once`);

  await page.locator('#where-does-it-hurt').screenshot({
    path: path.join(SHOTS, 'bodymap.png'),
  });

  // Every panel must point at a condition page that exists.
  const panelHrefs = await page.$$eval('.bm-panel a[href$=".html"]', (as) =>
    as.map((a) => a.getAttribute('href').split('?')[0])
  );
  const siteFiles = new Set(fs.readdirSync(path.join(__dirname, '..', 'site')));
  [...new Set(panelHrefs)].forEach((h) => {
    if (!siteFiles.has(h)) problems.push(`[bodymap] panel links to missing ${h}`);
  });

  // -- promised step count matches the wizard ------------------------------
  //
  // The booking page's lead claimed "four quick steps" while the stepper showed
  // five. Nobody abandons over it, but a client spots it instantly.
  await page.goto(`${BASE}/book.html`, { waitUntil: 'networkidle' });
  const dots = await page.$$eval('.progress-step', (els) => els.length);
  const lead = (await page.textContent('.page-head .lead')) || '';
  const WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const claimed = lead.match(/\b(two|three|four|five|six|seven)\s+quick\s+steps?\b/i);
  if (!claimed) {
    problems.push('[booking] page lead no longer states the step count');
  } else if (WORDS[claimed[1].toLowerCase()] !== dots) {
    problems.push(
      `[booking] lead promises ${claimed[1]} steps but the wizard shows ${dots}`
    );
  }
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });

  // -- photo slots ---------------------------------------------------------
  //
  // An empty slot must say it is waiting for a photo. Silently rendering a
  // blank branded panel is what made them read as broken.
  const slots = await page.$$eval('.photo-slot:not(.is-filled)', (els) =>
    els.map((e) => ({
      name: e.dataset.photo,
      note: !!e.querySelector('.photo-slot-note'),
      label: (e.querySelector('.photo-slot-label')?.textContent || '').trim(),
    }))
  );
  slots.forEach((s) => {
    if (!s.note) problems.push(`[photo] empty slot "${s.name}" has no "photo to come" note`);
    if (!s.label) problems.push(`[photo] empty slot "${s.name}" has no label`);
  });
  // A filled slot must NOT show the note over the top of the photograph.
  const filledWithNote = await page.$$eval(
    '.photo-slot.is-filled .photo-slot-note',
    (els) => els.length
  );
  if (filledWithNote) problems.push(`[photo] ${filledWithNote} filled slot(s) still show the note`);

  // Every real photograph must decode and fade in. They are lazy, so each one
  // has to be scrolled to before it is judged — checking without scrolling
  // reports every below-the-fold image as broken when nothing is wrong.
  const photoCount = await page.locator('img.photo').count();
  for (let i = 0; i < photoCount; i++) {
    const img = page.locator('img.photo').nth(i);
    await img.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const state = await img.evaluate((e) => ({
      ok: e.complete && e.naturalWidth > 0,
      shown: e.classList.contains('is-loaded'),
      alt: e.alt,
    }));
    if (!state.ok) problems.push(`[photo] "${state.alt}" did not load`);
    else if (!state.shown) problems.push(`[photo] "${state.alt}" loaded but never faded in`);
  }
  if (!photoCount) problems.push('[photo] no photographs on the home page at all');

  // -- theme toggle --------------------------------------------------------
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const themeBefore = await page.getAttribute('html', 'data-theme');
  await page.click('[data-theme-toggle]');
  await page.waitForTimeout(200);
  const themeAfter = await page.getAttribute('html', 'data-theme');
  if (themeBefore === themeAfter) problems.push('[theme] toggle did not change the theme');

  // The choice has to survive a navigation, or it reads as broken.
  await page.goto(`${BASE}/about-us.html`, { waitUntil: 'networkidle' });
  if ((await page.getAttribute('html', 'data-theme')) !== themeAfter) {
    problems.push('[theme] choice did not persist across pages');
  }
  await page.click('[data-theme-toggle]');
  await page.waitForTimeout(200);
  if ((await page.getAttribute('html', 'data-theme')) !== themeBefore) {
    problems.push('[theme] toggle did not switch back');
  }

  // -- internal links ------------------------------------------------------
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const hrefs = await page.$$eval('a[href]', (as) =>
    as.map((a) => a.getAttribute('href')).filter((h) => h && !/^(https?:|mailto:|tel:|sms:|#)/.test(h))
  );
  const files = new Set(fs.readdirSync(path.join(__dirname, '..', 'site')));
  [...new Set(hrefs)].forEach((h) => {
    const file = h.split('#')[0].split('?')[0];
    if (file && !files.has(file)) problems.push(`[link] index.html → missing ${file}`);
  });

  await browser.close();

  console.log('\n=== VERIFY ===');
  if (!problems.length) {
    console.log('All checks passed.');
  } else {
    console.log(`${problems.length} problem(s):`);
    [...new Set(problems)].forEach((p) => console.log(' - ' + p));
  }
  process.exit(problems.length ? 1 : 0);
})();
