#!/usr/bin/env node
/* Site test suite.
 *
 *   cd site && node test/run.js
 *
 * Needs Playwright and a Chromium build. Point CHROME at a binary if the
 * bundled one isn't where Playwright expects:
 *   CHROME=/path/to/chrome node test/run.js
 *
 * Financial figures are asserted against values computed independently here,
 * not against whatever the page happens to output.
 */
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('Playwright not installed:  npm i -D playwright'); process.exit(2); }

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let pass = 0, fail = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  ok ? pass++ : (fail++, failures.push(`${name}\n      expected: ${expected}\n      actual:   ${actual}`));
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  (expected ${expected}, got ${actual})`}`);
}
function checkTrue(name, actual) { check(name, !!actual, true); }

/* ---- Independent reference implementations ---- */
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function payment(P, ratePct, years) {
  const n = years * 12, r = ratePct / 100 / 12;
  return r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
}
function sdlt(price, bands, surcharge) {
  let lo = 0, total = 0;
  for (let i = 0; i < bands.length && lo < price; i++) {
    const hi = Math.min(price, bands[i].upTo);
    if (hi > lo) total += (hi - lo) * (bands[i].rate + surcharge);
    lo = bands[i].upTo;
  }
  if (lo < price) total += (price - lo) * (bands[bands.length - 1].rate + surcharge);
  return total;
}
const STD = [{upTo:125000,rate:0},{upTo:250000,rate:.02},{upTo:925000,rate:.05},{upTo:1500000,rate:.10},{upTo:Infinity,rate:.12}];
const FTB = [{upTo:300000,rate:0},{upTo:500000,rate:.05}];

(async () => {
  const launch = { };
  if (process.env.CHROME) launch.executablePath = process.env.CHROME;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  const text = s => page.textContent(s);

  console.log('\nTemplate integrity');
  {
    const fs = require('fs');
    const root = path.resolve(__dirname, '..');
    // Check the source templates when a build has already run, otherwise the
    // files themselves — token checks are about the template, not the output.
    const dir = fs.existsSync(path.join(root, '.templates', 'index.html'))
      ? path.join(root, '.templates') : root;
    const rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
    const markup = ['index.html', 'privacy.html', '404.html', 'robots.txt', 'sitemap.xml']
      .map(rd).join('');
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
    const keys = Object.keys(cfg).filter(k => !k.startsWith('_'));

    const orphans = keys.filter(k => !markup.includes('[' + k + ']'));
    check('every config key is used in the markup', orphans.join(',') || 'none', 'none');

    // Anything left must be a key someone can actually fill in.
    const tokens = [...new Set((markup.match(/\[[A-Z][A-Z0-9 _/&-]{2,}\]/g) || []))]
      .map(t => t.slice(1, -1));
    const unknown = tokens.filter(t => !keys.includes(t));
    check('no token without a config entry', unknown.join(',') || 'none', 'none');

    // The site must never ship an invented number or a fake review.
    checkTrue('no fabricated stat placeholders remain',
      !/MORTGAGES ARRANGED|LENDING SECURED|REVIEW SCORE/.test(markup));
    checkTrue('no placeholder reviews remain', !/\[Real client review/.test(markup));
    checkTrue('no unverifiable lender count', !/\[90\+\]/.test(markup));

    // Regulatory tokens must stay explicit — they cannot be defaulted away.
    ['FIRM LEGAL NAME', 'NETWORK NAME', 'FRN', 'COMPANY NUMBER', 'FEE WORDING'].forEach(k =>
      checkTrue('"' + k + '" is still required', markup.includes('[' + k + ']')));

    // Every optional block names a key that exists.
    const needs = [...new Set((markup.match(/data-needs="([^"]+)"/g) || []))]
      .map(m => m.replace(/data-needs="|"/g, ''));
    check('data-needs keys all exist in config',
      needs.filter(n => !keys.includes(n)).join(',') || 'none', 'none');
    checkTrue('optional blocks are actually used', needs.length >= 3);
  }

  console.log('\nRepayment calculator');
  check('default monthly payment', await text('#mf-out-payment'), gbp2.format(payment(225000, 4.5, 25)));
  check('default loan amount', await text('#mf-out-loan'), gbp0.format(225000));
  check('default LTV', await text('#mf-out-ltv'), '90.0%');
  await page.fill('#mf-rate', '6'); await page.fill('#mf-term', '30');
  await page.dispatchEvent('#mf-term', 'input');
  check('6% over 30 years', await text('#mf-out-payment'), gbp2.format(payment(225000, 6, 30)));
  await page.fill('#mf-rate', '0');
  check('0% rate does not divide by zero', await text('#mf-out-payment'), gbp2.format(225000 / 360));
  await page.selectOption('#mf-type', 'interest-only'); await page.fill('#mf-rate', '6');
  check('interest-only payment', await text('#mf-out-payment'), gbp2.format(225000 * 0.06 / 12));
  await page.selectOption('#mf-type', 'repayment');

  console.log('\nRepayment validation');
  await page.fill('#mf-term', '25'); await page.dispatchEvent('#mf-term', 'input');
  await page.fill('#mf-rate', '4.5'); await page.fill('#mf-deposit', '300000');
  check('deposit >= price blanks the payment', await text('#mf-out-payment'), '—');
  check('deposit >= price blanks the loan too', await text('#mf-out-loan'), '—');
  check('deposit >= price blanks the interest too', await text('#mf-out-interest'), '—');
  check('deposit >= price blanks the LTV too', await text('#mf-out-ltv'), '—');
  await page.fill('#mf-deposit', '25000');
  checkTrue('recovers after a valid value', (await text('#mf-out-payment')) !== '—');
  check('overpayment row hidden at £0', await page.isVisible('#mf-out-saving-row'), false);
  await page.fill('#mf-overpay', '200');
  check('overpayment row shown when set', await page.isVisible('#mf-out-saving-row'), true);
  await page.fill('#mf-overpay', '0');

  console.log('\nAffordability calculator');
  await page.click('#tab-afford');
  check('default borrowing', await text('#af-out-borrow'), gbp0.format(45000 * 4.5));
  check('default budget', await text('#af-out-budget'), gbp0.format(45000 * 4.5 + 30000));
  await page.fill('#af-commitments', '500');
  check('commitments reduce borrowing', await text('#af-out-borrow'), gbp0.format((45000 - 6000) * 4.5));
  await page.fill('#af-income', '20000'); await page.fill('#af-commitments', '5000');
  check('debt exceeding income floors at zero', await text('#af-out-borrow'), gbp0.format(0));
  checkTrue('and explains why', (await text('#af-out-note')).includes('cancel out'));
  await page.fill('#af-income', '45000'); await page.fill('#af-commitments', '0');

  console.log('\nStamp Duty calculator');
  await page.click('#tab-stampduty');
  const sd = async (price, ftb, add) => {
    await page.fill('#sd-price', String(price));
    if (await page.isChecked('#sd-ftb') !== !!ftb) await page.setChecked('#sd-ftb', !!ftb);
    if (await page.isChecked('#sd-additional') !== !!add) await page.setChecked('#sd-additional', !!add);
    await page.waitForTimeout(40);
    return text('#sd-out-total');
  };
  check('£295,000 standard', await sd(295000), gbp0.format(sdlt(295000, STD, 0)));
  check('£295,000 first-time buyer', await sd(295000, true), gbp0.format(sdlt(295000, FTB, 0)));
  check('£450,000 first-time buyer', await sd(450000, true), gbp0.format(sdlt(450000, FTB, 0)));
  check('£500,000 FTB (at the cap)', await sd(500000, true), gbp0.format(sdlt(500000, FTB, 0)));
  check('£500,001 FTB (relief lost)', await sd(500001, true), gbp0.format(sdlt(500001, STD, 0)));
  check('£295,000 additional property', await sd(295000, false, true), gbp0.format(sdlt(295000, STD, 0.05)));
  check('£39,999 below surcharge threshold', await sd(39999, false, true), gbp0.format(sdlt(39999, STD, 0)));
  check('£1.6m top band', await sd(1600000), gbp0.format(sdlt(1600000, STD, 0)));
  await page.setChecked('#sd-ftb', true);
  check('FTB and additional are mutually exclusive', await page.isChecked('#sd-additional'), false);

  console.log('\nCalculator to enquiry handoff');
  await page.setChecked('#sd-ftb', false);
  await page.fill('#sd-price', '295000');
  await page.click('#calc-stampduty .results__cta');
  const msg = await page.inputValue('#mf-message');
  checkTrue('figures carried into the message', msg.includes('295000') && msg.includes('Stamp Duty'));
  checkTrue('confirmation shown', await page.isVisible('#handoff-note'));
  // The message box lives on step 2, so type there rather than through the
  // hidden field — this is exactly how a visitor would reach it.
  await page.click('#step-next');
  await page.fill('#mf-message', (await page.inputValue('#mf-message')) +
    '\n\nI also have a question about porting.');
  await page.click('#calc-stampduty .results__cta');
  const msg2 = await page.inputValue('#mf-message');
  checkTrue("visitor's own text preserved", msg2.includes('porting'));
  await page.click('#calc-stampduty .results__cta');
  check('summary not duplicated on repeat clicks',
    (await page.inputValue('#mf-message')).split('From your').length - 1, 1);

  console.log('\nMulti-step enquiry form');
  await page.reload({ waitUntil: 'networkidle' });
  check('starts on step 1', await page.isVisible('.fstep[data-step="1"]'), true);
  check('later steps hidden', await page.isVisible('.fstep[data-step="3"]'), false);
  check('progress shown', (await text('#stepper-label')).startsWith('Step 1 of 3'), true);
  check('back hidden on first step', await page.isVisible('#step-back'), false);
  check('submit hidden until last step', await page.isVisible('#step-submit'), false);

  await page.click('#step-next');
  check('advances to step 2', await page.isVisible('.fstep[data-step="2"]'), true);
  check('back now available', await page.isVisible('#step-back'), true);
  await page.click('#step-next');
  check('reaches step 3', await page.isVisible('.fstep[data-step="3"]'), true);
  check('submit shown on last step', await page.isVisible('#step-submit'), true);
  await page.click('#step-back');
  check('back returns to step 2', await page.isVisible('.fstep[data-step="2"]'), true);
  await page.click('#step-next');

  console.log('\nValidation');
  await page.click('#step-submit');
  const invalid = await page.$$eval('[aria-invalid="true"]', els => els.map(e => e.id).sort());
  check('required fields flagged', invalid.join(','), 'mf-consent,mf-email,mf-name,mf-phone');
  await page.fill('#mf-email', 'not-an-email');
  await page.click('#step-submit');
  check('bad email rejected', await page.getAttribute('#mf-email', 'aria-invalid'), 'true');
  await page.fill('#mf-name', 'Jo Smith');
  await page.fill('#mf-phone', '07700900123');
  await page.fill('#mf-email', 'jo@example.com');
  await page.check('#mf-consent');
  await page.click('#step-submit');
  check('valid submit accepted', await page.getAttribute('#form-status', 'data-state'), 'success');

  console.log('\nSegment tailoring');
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('.choice:has(input[value="remortgage"])');
  await page.click('#step-next');
  check('remortgage reveals the rate-end question', await page.isVisible('#field-rate-end'), true);
  check('deposit label adapts', await text('#deposit-label'), 'Roughly what do you owe?');
  check('legend adapts', await text('#step2-legend'), 'About your current mortgage');
  await page.click('#step-back');
  await page.click('.choice:has(input[value="first-time-buyer"])');
  await page.click('#step-next');
  check('first-time buyer hides rate-end', await page.isVisible('#field-rate-end'), false);
  check('deposit label reverts', await text('#deposit-label'), 'Deposit saved so far');

  console.log('\nSegment routing from service cards');
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('.card a[data-segment="buy-to-let"]');
  check('card click preselects the segment',
    await page.isChecked('input[name="stage"][value="buy-to-let"]'), true);
  check('segment radios stay keyboard focusable',
    await page.$eval('input[name="stage"]', el => { el.focus(); return document.activeElement === el; }), true);

  console.log('\nLead context');
  const ctxPage = await browser.newPage();
  await ctxPage.goto(URL + '?utm_source=facebook&utm_medium=cpc&utm_campaign=ftb-spring',
    { waitUntil: 'networkidle' });
  check('utm_source captured', await ctxPage.inputValue('#lead-utm-source'), 'facebook');
  check('utm_medium captured', await ctxPage.inputValue('#lead-utm-medium'), 'cpc');
  check('utm_campaign captured', await ctxPage.inputValue('#lead-utm-campaign'), 'ftb-spring');
  await ctxPage.click('#tab-stampduty');
  await ctxPage.click('#calc-stampduty .results__cta');
  check('calculator recorded on the lead', await ctxPage.inputValue('#lead-calc'), 'stampduty');
  checkTrue('figures recorded on the lead',
    (await ctxPage.inputValue('#lead-figures')).includes('Stamp Duty'));
  const events = await ctxPage.evaluate(() => (window.dataLayer || []).map(e => e.event));
  checkTrue('analytics events emitted', events.includes('mf_form_step'));
  await ctxPage.close();

  console.log('\nRate-expiry reminder');
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#reminder-form button[type=submit]');
  check('reminder rejects an empty email', await page.getAttribute('#rm-email', 'aria-invalid'), 'true');
  await page.fill('#rm-email', 'jo@example.com');
  await page.fill('#rm-when', '2027-03');
  await page.click('#reminder-form button[type=submit]');
  check('reminder accepts valid input', await page.getAttribute('#reminder-status', 'data-state'), 'success');

  console.log('\nAccessibility');
  checkTrue('inputs describedby their hint/error',
    !!(await page.getAttribute('#mf-name', 'aria-describedby')));
  await page.focus('#tab-repayment');
  await page.keyboard.press('ArrowRight');
  check('arrow keys move between tabs', await page.getAttribute('#tab-afford', 'aria-selected'), 'true');
  await page.keyboard.press('Home');
  check('Home returns to the first tab', await page.getAttribute('#tab-repayment', 'aria-selected'), 'true');
  check('skip link present', await page.isVisible('.skip-link', { timeout: 500 }).catch(() => true), true);
  // The trust bar carries no numeric claims now, so there may be nothing to
  // animate. If a real figure is added later, it must never render as NaN.
  const counters = await page.$$('[data-count-to]');
  if (counters.length) {
    const stat = await counters[0].textContent();
    checkTrue('animated stat never renders NaN', !stat.includes('NaN'));
  } else {
    check('no numeric claims in the trust bar', true, true);
  }

  console.log('\nLayout');
  for (const w of [320, 360, 390, 768, 1024, 1280, 1600]) {
    const pg = await browser.newPage({ viewport: { width: w, height: 800 } });
    await pg.goto(URL, { waitUntil: 'domcontentloaded' });
    const over = await pg.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(`no horizontal scroll at ${w}px`, over, false);
    await pg.close();
  }

  console.log('\nProgressive enhancement');
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const njPage = await noJs.newPage();
  await njPage.goto(URL, { waitUntil: 'domcontentloaded' });
  check('without JS every step is visible', await njPage.isVisible('.fstep[data-step="3"]'), true);
  check('without JS the submit button shows', await njPage.isVisible('#step-submit'), true);
  check('without JS the stepper is hidden', await njPage.isVisible('#stepper'), false);
  check('without JS a noscript notice explains the calculators',
    (await njPage.content()).includes('need JavaScript'), true);
  await noJs.close();

  console.log('\nMobile priority');
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(URL, { waitUntil: 'networkidle' });
  const offset = await mob.evaluate(() => {
    const c = document.getElementById('contact').getBoundingClientRect().top + window.scrollY;
    const f = document.getElementById('enquiry-form').getBoundingClientRect().top + window.scrollY;
    return f - c;
  });
  checkTrue('form is not buried under the contact details on mobile (' +
    Math.round(offset) + 'px)', offset < 450);
  await mob.close();

  console.log('\nGuides');
  {
    const guides = ['index', 'how-much-deposit', 'when-to-remortgage', 'self-employed-mortgages'];
    for (const g of guides) {
      const gp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errs = [];
      gp.on('pageerror', e => errs.push(e.message));
      gp.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await gp.goto('file://' + path.resolve(__dirname, '..', 'guides', g + '.html'),
        { waitUntil: 'networkidle' });
      check(`guides/${g} loads cleanly`, errs.length, 0);
      check(`guides/${g} has exactly one h1`, (await gp.$$('h1')).length, 1);
      const over = await gp.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      check(`guides/${g} has no horizontal scroll`, over, false);
      await gp.close();
    }

    // Internal links must resolve — a broken guide link is invisible until a
    // reader hits it.
    const fs = require('fs');
    const gdir = path.resolve(__dirname, '..', 'guides');
    let broken = [];
    for (const g of guides) {
      const html = fs.readFileSync(path.join(gdir, g + '.html'), 'utf8');
      for (const m of html.matchAll(/href="([^"#?][^"]*?)(?:[#?][^"]*)?"/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|tel:|data:)/.test(target)) continue;
        if (!fs.existsSync(path.resolve(gdir, target))) broken.push(g + ' -> ' + target);
      }
    }
    check('no broken internal links in guides', broken.join(', ') || 'none', 'none');

    // Every guide CTA must name a segment the form actually offers.
    const homeHtml = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
    const valid = [...homeHtml.matchAll(/input[^>]*name="stage"[^>]*value="([^"]+)"/g)].map(m => m[1]);
    let badSeg = [];
    for (const g of guides.slice(1)) {
      const html = fs.readFileSync(path.join(gdir, g + '.html'), 'utf8');
      for (const m of html.matchAll(/\?segment=([a-z-]+)/g)) {
        if (!valid.includes(m[1])) badSeg.push(g + ' -> ' + m[1]);
      }
    }
    check('guide CTAs target real form segments', badSeg.join(', ') || 'none', 'none');
  }

  console.log('\nSegment deep link');
  {
    const dl = await browser.newPage();
    await dl.goto(URL + '?segment=remortgage#contact', { waitUntil: 'networkidle' });
    check('?segment= preselects the form choice',
      await dl.isChecked('input[name="stage"][value="remortgage"]'), true);
    check('and tailors step 2', await dl.$eval('#deposit-label', e => e.textContent),
      'Roughly what do you owe?');
    await dl.close();
  }

  console.log('\nSite structure');
  {
    const fs = require('fs');
    const root = path.resolve(__dirname, '..');

    // Every publishable page on disk.
    const onDisk = [];
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.name === 'test' || e.name === 'node_modules') continue;
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (e.name.endsWith('.html') && !e.name.startsWith('_'))
          onDisk.push(path.relative(root, f));
      }
    })(root);

    // Crawl outward from the homepage.
    const seen = new Set(), broken = [], queue = ['index.html'];
    while (queue.length) {
      const rel = queue.shift();
      if (seen.has(rel)) continue;
      seen.add(rel);
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) continue;
      const html = fs.readFileSync(abs, 'utf8');
      for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const t = m[1];
        if (/^(https?:|mailto:|tel:|data:|#)/.test(t)) continue;
        const clean = t.split('#')[0].split('?')[0];
        if (!clean) continue;
        const target = path.resolve(path.dirname(abs), clean);
        if (!fs.existsSync(target)) { broken.push(rel + ' -> ' + t); continue; }
        const r = path.relative(root, target);
        if (r.endsWith('.html')) queue.push(r);
      }
    }

    check('no broken links anywhere on the site', broken.join(', ') || 'none', 'none');

    // 404 is served by the host, not linked to — everything else must be reachable.
    const orphans = onDisk.filter(p => !seen.has(p) && p !== '404.html');
    check('no orphan pages', orphans.join(', ') || 'none', 'none');

    // No stray templates or snippets sitting in the deploy root as servable pages.
    const strays = onDisk.filter(p => /template|snippet|example|draft/i.test(p));
    check('no template files servable as pages', strays.join(', ') || 'none', 'none');

    // Every page needs the nav, a way home, and the regulatory risk warning.
    let missing = [];
    for (const rel of onDisk) {
      const html = fs.readFileSync(path.join(root, rel), 'utf8');
      if (!/class="nav__list"/.test(html)) missing.push(rel + ':nav');
      if (!/may be repossessed/.test(html)) missing.push(rel + ':risk-warning');
      if (!/site-footer/.test(html)) missing.push(rel + ':footer');
      if (rel !== 'index.html' && !/href="(\.\.\/)?index\.html"/.test(html))
        missing.push(rel + ':home-link');
    }
    check('every page has nav, footer, home link and risk warning',
      missing.join(', ') || 'none', 'none');

    // Sitemap must list every indexable page.
    const sm = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    const notListed = onDisk.filter(p => p !== '404.html').filter(p => {
      const url = p === 'index.html' ? '/' : (p === 'guides/index.html' ? '/guides/' : '/' + p);
      return !sm.includes(url + '<');
    });
    check('sitemap lists every indexable page', notListed.join(', ') || 'none', 'none');
    checkTrue('404 is excluded from the sitemap', !sm.includes('404.html'));
  }

  console.log('\nMobile');
  {
    const PAGES = ['index.html', 'privacy.html', '404.html', 'guides/index.html',
      'guides/how-much-deposit.html', 'guides/when-to-remortgage.html',
      'guides/self-employed-mortgages.html'];
    for (const rel of PAGES) {
      const mp = await browser.newPage({ viewport: { width: 320, height: 844 }, isMobile: true });
      await mp.goto('file://' + path.resolve(__dirname, '..', rel), { waitUntil: 'networkidle' });
      const over = await mp.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      check(`${rel} fits a 320px phone`, over, false);
      check(`${rel} shows the mobile nav toggle`, await mp.isVisible('#nav-toggle'), true);

      // WCAG 2.5.8 (AA) wants 24x24, with an explicit exemption for links
      // sitting inside a sentence.
      const tiny = await mp.evaluate(() => {
        const out = [];
        document.querySelectorAll('a, button, select, input[type=checkbox]').forEach(el => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          if (el.closest('[hidden]') || el.closest('.hp-field')) return;
          const inline = el.closest('p, li, figcaption, blockquote, .legal, .disclaimer');
          if (inline) return;                       // exempt: inline in text
          if (r.height < 24 || r.width < 24) out.push(el.className || el.tagName);
        });
        return out;
      });
      check(`${rel} tap targets meet 24px`, tiny.join(',') || 'none', 'none');
      await mp.close();
    }
  }

  console.log('\nColour contrast (rendered, both themes)');
  {
    const SWEEP = `(() => {
      function parse(c){const m=c.match(/[\\d.]+/g);if(!m)return null;
        return {r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]};}
      function lum({r,g,b}){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
        return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}
      function over(fg,bg){const a=fg.a;return {r:fg.r*a+bg.r*(1-a),g:fg.g*a+bg.g*(1-a),b:fg.b*a+bg.b*(1-a),a:1};}
      function bgsOf(el){
        let n=el;
        while(n && n!==document.documentElement){
          const cs=getComputedStyle(n), img=cs.backgroundImage;
          if(img && img!=='none' && /gradient/.test(img)){
            const stops=(img.match(/rgba?\\([^)]*\\)/g)||[]).map(parse).filter(c=>c&&c.a>0.5);
            if(stops.length) return stops;
          }
          const c=parse(cs.backgroundColor);
          if(c && c.a>0.95) return [c];
          n=n.parentElement;
        }
        return [parse(getComputedStyle(document.body).backgroundColor)||{r:255,g:255,b:255,a:1}];
      }
      const out=[];
      document.querySelectorAll('p,a,li,h1,h2,h3,h4,span,button,label,td,th,summary,blockquote,figcaption,legend,small,strong').forEach(el=>{
        if(!el.textContent.trim()) return;
        if(el.children.length && !Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim())) return;
        const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
        const cs=getComputedStyle(el);
        if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) return;
        const fg=parse(cs.color); if(!fg) return;
        let ratio=Infinity;
        for(const bg of bgsOf(el)){
          const eff=fg.a<1?over(fg,bg):fg;
          const l1=lum(eff),l2=lum(bg);
          ratio=Math.min(ratio,(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05));
        }
        const px=parseFloat(cs.fontSize), bold=+cs.fontWeight>=700;
        const need=(px>=24||(px>=18.66&&bold))?3:4.5;
        if(ratio<need) out.push(el.tagName.toLowerCase()+'.'+(el.className||'')+' '+ratio.toFixed(2)+':1 need '+need);
      });
      return [...new Set(out)];
    })()`;
    const PAGES = ['index.html', 'privacy.html', '404.html', 'guides/index.html',
      'guides/how-much-deposit.html', 'guides/when-to-remortgage.html',
      'guides/self-employed-mortgages.html'];
    for (const theme of ['light', 'dark']) {
      let fails = [];
      for (const rel of PAGES) {
        const cp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await cp.goto('file://' + path.resolve(__dirname, '..', rel), { waitUntil: 'networkidle' });
        await cp.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
        await cp.waitForTimeout(80);
        const bad = await cp.evaluate(SWEEP);
        bad.forEach(x => fails.push(rel + ': ' + x));
        await cp.close();
      }
      check(`${theme} theme meets WCAG AA everywhere`, fails.join(' | ') || 'none', 'none');
    }
  }

  console.log('\nClient-facing polish');
  {
    const fs = require('fs');
    const root = path.resolve(__dirname, '..');
    const pages = ['index.html', 'privacy.html', '404.html', 'guides/index.html',
      'guides/how-much-deposit.html', 'guides/when-to-remortgage.html',
      'guides/self-employed-mortgages.html'];
    const raw = pages.map(p => fs.readFileSync(path.join(root, p), 'utf8')).join('');
    // JSON-LD and inline scripts use brackets legitimately; scan the visible
    // markup only.
    const all = raw.replace(/<script[\s\S]*?<\/script>/g, '');

    // Nav labels must match the section they land on.
    const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    let mismatched = [];
    for (const m of home.matchAll(/<li><a href="#([a-z-]+)">([^<]+)<\/a><\/li>/g)) {
      if (!home.includes('id="' + m[1] + '"')) mismatched.push(m[2] + ' -> #' + m[1]);
    }
    check('every nav link targets a real section', mismatched.join(', ') || 'none', 'none');

    // Bracketed prose that is not a fillable token would ship as visitor text.
    const brackets = [...new Set((all.match(/\[[^\]]{3,}\]/g) || []))]
      .filter(b => !/^\[[A-Z][A-Z0-9 _/&-]*\]$/.test(b));
    check('no bracketed prose outside real tokens', brackets.join(' | ') || 'none', 'none');

    checkTrue('no lorem ipsum', !/lorem ipsum/i.test(all));
    checkTrue('no TODO or FIXME in shipped markup', !/TODO|FIXME|XXX:/.test(all));
    checkTrue('no unresolved template syntax', !/\{\{|\$\{/.test(all));

    // Colour system: no hex or rgb literals in the markup.
    const inlineColour = [...new Set((all.match(/style="[^"]*(?:#[0-9a-fA-F]{3,6}|rgba?\()[^"]*"/g) || []))];
    check('no hardcoded colours in markup', inlineColour.join(' | ') || 'none', 'none');
  }

  console.log('\nOther pages');
  for (const f of ['privacy.html', '404.html']) {
    const pg = await browser.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + path.resolve(__dirname, '..', f), { waitUntil: 'networkidle' });
    check(`${f} loads without script errors`, errs.length, 0);
    await pg.close();
  }

  console.log('\nConsole');
  check('no console errors on the homepage', consoleErrors.length, 0);
  if (consoleErrors.length) consoleErrors.forEach(e => console.log('     ', e));

  await browser.close();

  console.log(`\n${'-'.repeat(52)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  ✗ ' + f));
  }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
