#!/usr/bin/env node
/* Pull business details out of the old site and into config.json.
 *
 *   node import-from-old-site.js old-site.html
 *   pbpaste | node import-from-old-site.js -          (paste the page source)
 *
 * Save the old page first: open it, Ctrl+S (or Ctrl+U then copy the source).
 *
 * It never overwrites a value already filled in config.json — run it, check
 * the report, correct anything it guessed wrong, and re-run safely.
 * Nothing is invented: whatever it cannot find is reported as missing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node import-from-old-site.js <file.html|->');
  process.exit(2);
}
const raw = arg === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(arg, 'utf8');

/* Strip markup but keep the text order, so proximity still means something. */
const text = raw
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#0?39;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s*\n+/g, '\n')
  .trim();

const found = {};
const notes = [];

function first(re, group) {
  const m = text.match(re);
  return m ? (m[group === undefined ? 0 : group] || '').trim() : '';
}
function all(re, group) {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = r.exec(text)) !== null) {
    const v = (m[group === undefined ? 0 : group] || '').trim();
    if (v && out.indexOf(v) === -1) out.push(v);
  }
  return out;
}

/* ---- Email ---- */
const emails = all(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  .filter(e => !/\.(png|jpe?g|gif|svg|webp)$/i.test(e))
  .filter(e => !/(example|sentry|wixpress|godaddy|squarespace)\./i.test(e));
if (emails.length) {
  found['EMAIL ADDRESS'] = emails[0];
  if (emails.length > 1) notes.push('Several email addresses found: ' + emails.join(', ') + ' — check the right one was used.');
}

/* ---- Phone ---- */
const phones = all(/(?:\+44\s?\d{2,4}|\(?0\d{3,4}\)?)[\s-]?\d{3,4}[\s-]?\d{3,4}/)
  .map(p => p.trim())
  .filter(p => p.replace(/\D/g, '').length >= 10 && p.replace(/\D/g, '').length <= 13)
  // Dates and prices get caught by loose phone patterns; require a leading 0 or +44.
  .filter(p => /^(\+44|\(?0)/.test(p));
if (phones.length) {
  found['PHONE NUMBER'] = phones[0];
  const digits = phones[0].replace(/[^\d+]/g, '');
  found['PHONE-E164'] = digits.startsWith('+') ? digits : '+44' + digits.replace(/^0/, '');
  if (phones.length > 1) notes.push('Several phone numbers found: ' + phones.join(', ') + ' — check the right one was used.');
}

/* ---- FCA firm reference ---- */
const frn = first(/(?:FRN|firm reference(?: number)?|reference number|FCA (?:no|number|reference))\D{0,15}(\d{6,7})/i, 1)
         || first(/register\.fca\.org\.uk\/[^\s]*?(\d{6,7})/i, 1);
if (frn) found['FRN'] = frn;

/* ---- Network / principal firm ---- */
const network = first(/appointed representative of ([A-Z][A-Za-z0-9 .,'&()-]{3,70}?)(?:,| which| who| that|\.|$)/i, 1);
if (network) found['NETWORK NAME'] = network.replace(/\s+/g, ' ').trim();

/* ---- Legal / company name ----
   A lazy match starting at any capital swallows the connector words
   ("Fixer Sam is a trading name of ..."), so require an unbroken run of
   capitalised words immediately before the suffix. */
const COMPANY = /((?:[A-Z][A-Za-z0-9&'.-]*[ ]+){1,5}(?:Ltd\.?|Limited|LLP|PLC))/;
let legal = first(new RegExp('trading name of\\s+' + COMPANY.source, 'i'), 1) || first(COMPANY, 1);
// Never report the network as the firm itself.
if (legal && network && legal.replace(/\.$/, '') === network.replace(/\.$/, '')) {
  const others = all(COMPANY, 1).filter(n => n.replace(/\.$/, '') !== network.replace(/\.$/, ''));
  legal = others[0] || '';
}
if (legal) found['FIRM LEGAL NAME'] = legal.replace(/\s+/g, ' ').trim();

/* ---- Companies House number ---- */
const coNo = first(/(?:company (?:number|no\.?)|registered in England(?: and Wales)?[^\d]{0,30})\s*([A-Z]{0,2}\d{6,8})/i, 1);
if (coNo) found['COMPANY NUMBER'] = coNo;

/* ---- Postcode and address ---- */
const postcode = first(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/);
if (postcode) found['POSTCODE'] = postcode;

/* ---- Adviser surname ---- */
const STOP = /^(Is|The|And|Will|Can|Has|Was|Helping|Here|Was|Would|Could|Says|Today|About|Our|Your|My)$/;
const surnames = all(/\bSam[ ]+([A-Z][a-z]{2,20})\b/, 1).filter(n => !STOP.test(n));
if (surnames.length) found['SURNAME'] = surnames[0];

/* ---- Domain ---- */
const domain = first(/https?:\/\/(?:www\.)?([a-z0-9-]+\.(?:co\.uk|com|uk|net|org)(?:\.[a-z]{2})?)/i, 1);
if (domain && !/chatgpt\.site|google|facebook|twitter|linkedin|instagram|youtube|fca\.org|ico\.org/i.test(domain)) {
  found['YOUR-DOMAIN'] = domain;
}

/* ---- Address: take the line the postcode sits on ---- */
if (postcode) {
  const line = (text.split('\n').find(l => l.includes(postcode)) || '')
    .replace(/^\s*(?:office|address|find (?:me|us)|visit (?:me|us)|studio)\s*:?\s*/i, '')
    .trim();
  if (line && line.length < 160) {
    found['ADDRESS'] = line;
    found['POSTAL ADDRESS'] = line;
    const parts = line.split(',').map(x => x.trim()).filter(Boolean);
    // Last part is the postcode, the one before it is usually the town.
    const townIdx = parts.findIndex(x => x.includes(postcode)) - 1;
    if (townIdx >= 0 && parts[townIdx] && parts[townIdx].length < 40) found['TOWN'] = parts[townIdx];
    const street = parts.slice(0, Math.max(0, townIdx)).join(', ');
    if (street) found['STREET'] = street;
  }
}

/* ---- Things a human must review rather than import ---- */
const quotes = all(/[“"]([^”"]{40,300})[”"]/, 1)
  .filter(q => /\b(sam|he|she|they|service|help|mortgage|recommend|thank)\b/i.test(q));
const hours = all(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?[^\n]{0,60}\d{1,2}(?::\d{2})?\s?(?:am|pm)[^\n]{0,40})/i, 1);
const socials = all(/https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|twitter|x|youtube|tiktok)\.com\/[^\s"'<)]+/i);

/* ---- Merge into config.json without clobbering ---- */
const cfgPath = path.join(__dirname, 'config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const written = [], skipped = [];

Object.keys(found).forEach(k => {
  if (!(k in cfg)) return;
  if (!String(found[k]).trim()) return;   // never write a blank over a placeholder
  if (String(cfg[k]).trim()) { skipped.push(`${k} (already set to "${cfg[k]}")`); return; }
  cfg[k] = found[k];
  written.push(`${k} = ${found[k]}`);
});
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

/* ---- Report ---- */
const missing = Object.keys(cfg).filter(k => !k.startsWith('_') && !String(cfg[k]).trim());

console.log('\nIMPORTED INTO config.json');
console.log('='.repeat(58));
written.length ? written.forEach(w => console.log('  + ' + w)) : console.log('  (nothing new)');

if (skipped.length) {
  console.log('\nLEFT ALONE (already filled in)');
  skipped.forEach(s => console.log('  · ' + s));
}

if (quotes.length || hours.length || socials.length) {
  console.log('\nFOUND, BUT NEEDS A HUMAN');
  hours.forEach(h => console.log('  opening hours:  ' + h));
  socials.forEach(s => console.log('  social:         ' + s));
  quotes.forEach(q => console.log('  possible review: "' + q.slice(0, 110) + (q.length > 110 ? '…' : '') + '"'));
  if (quotes.length) {
    console.log('\n  Reviews must be genuine and verifiable before they go back on the site.');
    console.log('  Copy them into index.html by hand once confirmed.');
  }
}

console.log('\nSTILL NEEDED — ask Sam');
console.log('='.repeat(58));
missing.length ? missing.forEach(m => console.log('  - ' + m)) : console.log('  Nothing. Run ./fill-placeholders.sh');

if (notes.length) {
  console.log('\nCHECK THESE');
  notes.forEach(n => console.log('  ! ' + n));
}

console.log('\nNext:  ./fill-placeholders.sh\n');
