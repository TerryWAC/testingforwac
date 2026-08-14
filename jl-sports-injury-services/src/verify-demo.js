/** Checks the single-file demo: routing, deep links and the booking flow. */

const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.join(__dirname, '..', 'demo.html');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ROUTES = [
  'index', 'about-us', 'services', 'injury-assessment', 'sports-massage',
  'deep-tissue-massage', 'follow-up-treatment', 'medical-acupuncture',
  'electrotherapy', 'ultrasound-therapy', 'book', 'contact', 'privacy-policy',
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const problems = [];

  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[console] ${m.text()}`);
  });

  await page.goto(FILE, { waitUntil: 'load' });

  // Exactly one page visible on first load, and it is home.
  const visible = await page.locator('.demo-page:not([hidden])').count();
  if (visible !== 1) problems.push(`[router] ${visible} pages visible on load, expected 1`);
  const first = await page.locator('.demo-page:not([hidden])').getAttribute('data-route');
  if (first !== 'index') problems.push(`[router] landed on "${first}", expected index`);

  // Every route resolves and shows exactly one page.
  for (const r of ROUTES) {
    await page.goto(`${FILE}#/${r}`, { waitUntil: 'load' });
    await page.waitForTimeout(120);
    const n = await page.locator('.demo-page:not([hidden])').count();
    const got = await page.locator('.demo-page:not([hidden])').getAttribute('data-route');
    if (n !== 1) problems.push(`[router] #/${r} showed ${n} pages`);
    if (got !== r) problems.push(`[router] #/${r} showed "${got}"`);
  }

  // Unknown route falls back to home rather than a blank screen.
  await page.goto(`${FILE}#/nope`, { waitUntil: 'load' });
  await page.waitForTimeout(120);
  const fallback = await page.locator('.demo-page:not([hidden])').getAttribute('data-route');
  if (fallback !== 'index') problems.push(`[router] unknown route showed "${fallback}"`);

  // In-page navigation via a real click.
  await page.goto(FILE, { waitUntil: 'load' });
  await page.click('.nav-link[href="#/about-us"]');
  await page.waitForTimeout(250);
  const afterClick = await page.locator('.demo-page:not([hidden])').getAttribute('data-route');
  if (afterClick !== 'about-us') problems.push(`[router] nav click landed on "${afterClick}"`);

  // No link still points at a .html file.
  const stale = await page.$$eval('a[href$=".html"]', (as) => as.map((a) => a.getAttribute('href')));
  if (stale.length) problems.push(`[router] ${stale.length} unrewritten links: ${stale.slice(0, 3)}`);

  // Every route referenced by a link actually exists.
  const routes = await page.$$eval('a[href^="#/"]', (as) =>
    [...new Set(as.map((a) => a.getAttribute('href').replace(/^#\//, '').split('?')[0]))]
  );
  const known = new Set(ROUTES);
  routes.forEach((r) => { if (!known.has(r)) problems.push(`[router] link to unknown route "${r}"`); });

  // Deep link preselects the treatment, exactly as on the real site.
  await page.goto(`${FILE}#/book?treatment=electrotherapy`, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  const checked = await page.locator('input[name="treatment"]:checked').getAttribute('value');
  if (checked !== 'electrotherapy') problems.push(`[booking] deep link preselected "${checked}"`);

  // Full booking flow inside the demo.
  await page.goto(`${FILE}#/book`, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.click('input[name="treatment"][value="injury-assessment"]', { force: true });
  await page.click('[data-next="0"]');
  await page.waitForTimeout(300);
  await page.click('[data-next="1"]');
  await page.waitForTimeout(300);
  await page.click('#day-options .opt:first-child input', { force: true });
  await page.click('[data-next="2"]');
  await page.waitForTimeout(300);
  const slots = await page.locator('#time-options .opt').count();
  if (slots !== 21) problems.push(`[booking] ${slots} slots in demo, expected 21`);
  await page.click('#time-options .opt:first-child input', { force: true });
  await page.click('[data-next="3"]');
  await page.waitForTimeout(300);
  await page.fill('#bk-name', 'Sam Taylor');
  await page.fill('#bk-phone', '07700 900456');
  await page.fill('#bk-email', 'sam@example.com');
  await page.check('input[name="consent"]');
  await page.click('[data-next="4"]');
  await page.waitForTimeout(500);
  const done = await page.locator('#step-done.is-active').count();
  if (!done) problems.push('[booking] demo confirmation step did not show');
  const price = await page.locator('#step-done [data-sum="price"]').textContent();
  if (price !== '£44') problems.push(`[booking] demo summary price "${price}"`);

  // FAQ accordions stay independent between the two pages that carry them.
  await page.goto(`${FILE}#/index`, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.click('[data-route="index"] .faq-item:first-child .faq-q');
  await page.waitForTimeout(400);
  const homeOpen = await page.locator('[data-route="index"] .faq-item.is-open').count();
  const servicesOpen = await page.locator('[data-route="services"] .faq-item.is-open').count();
  if (homeOpen !== 1) problems.push(`[faq] home accordion opened ${homeOpen}`);
  if (servicesOpen !== 0) problems.push(`[faq] services accordion also opened (${servicesOpen})`);

  // No duplicate ids left in the document.
  const dupes = await page.evaluate(() => {
    const seen = {}, out = [];
    document.querySelectorAll('[id]').forEach((el) => {
      seen[el.id] = (seen[el.id] || 0) + 1;
      if (seen[el.id] === 2) out.push(el.id);
    });
    return out;
  });
  if (dupes.length) problems.push(`[html] duplicate ids: ${dupes.slice(0, 6).join(', ')}`);

  await browser.close();

  console.log('\n=== DEMO VERIFY ===');
  if (!problems.length) console.log('All checks passed.');
  else {
    console.log(`${problems.length} problem(s):`);
    [...new Set(problems)].forEach((p) => console.log(' - ' + p));
  }
  process.exit(problems.length ? 1 : 0);
})();
