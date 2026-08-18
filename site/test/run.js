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
  await page.fill('#mf-message', 'I also have a question about porting.');
  await page.click('#calc-stampduty .results__cta');
  const msg2 = await page.inputValue('#mf-message');
  checkTrue("visitor's own text preserved", msg2.includes('porting'));
  await page.click('#calc-stampduty .results__cta');
  check('summary not duplicated on second click',
    (await page.inputValue('#mf-message')).split('From your').length - 1, 1);

  console.log('\nEnquiry form');
  await page.fill('#mf-message', '');
  await page.click('#enquiry-form button[type=submit]');
  const invalid = await page.$$eval('[aria-invalid="true"]', els => els.map(e => e.id).sort());
  check('required fields flagged', invalid.join(','), 'mf-consent,mf-email,mf-name,mf-phone');
  await page.fill('#mf-email', 'not-an-email');
  await page.click('#enquiry-form button[type=submit]');
  check('bad email rejected', await page.getAttribute('#mf-email', 'aria-invalid'), 'true');
  await page.fill('#mf-name', 'Jo Smith');
  await page.fill('#mf-phone', '07700900123');
  await page.fill('#mf-email', 'jo@example.com');
  await page.check('#mf-consent');
  await page.click('#enquiry-form button[type=submit]');
  check('valid submit accepted', await page.getAttribute('#form-status', 'data-state'), 'success');

  console.log('\nAccessibility');
  checkTrue('inputs describedby their hint/error',
    !!(await page.getAttribute('#mf-name', 'aria-describedby')));
  await page.focus('#tab-repayment');
  await page.keyboard.press('ArrowRight');
  check('arrow keys move between tabs', await page.getAttribute('#tab-afford', 'aria-selected'), 'true');
  await page.keyboard.press('Home');
  check('Home returns to the first tab', await page.getAttribute('#tab-repayment', 'aria-selected'), 'true');
  check('skip link present', await page.isVisible('.skip-link', { timeout: 500 }).catch(() => true), true);
  const stat = await text('[data-count-to]');
  checkTrue('placeholder stat not animated to NaN', !stat.includes('NaN'));

  console.log('\nLayout');
  for (const w of [320, 360, 390, 768, 1024, 1280, 1600]) {
    const pg = await browser.newPage({ viewport: { width: w, height: 800 } });
    await pg.goto(URL, { waitUntil: 'domcontentloaded' });
    const over = await pg.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(`no horizontal scroll at ${w}px`, over, false);
    await pg.close();
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
