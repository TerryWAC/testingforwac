/**
 * Renders the Open Graph image and the apple-touch-icon from the brand SVG.
 *
 *   node src/make-images.js
 */

const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, '..', 'site', 'assets', 'img');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MARK = `<svg viewBox="0 0 200 200" class="mark">
  <mask id="m"><circle cx="100" cy="100" r="96" fill="#fff"/>
    <path d="M62 30 H88 V116 C88 141 69 156 46 156 C32 156 21 151 13 143 L27 122 C32 128 38 131 45 131 C55 131 62 125 62 113 Z" fill="#000"/>
    <path d="M106 30 H132 V126 H192 V152 H106 Z" fill="#000"/>
  </mask>
  <circle cx="100" cy="100" r="96" fill="#00FA82" mask="url(#m)"/>
</svg>`;

const og = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="http://127.0.0.1:8899/assets/css/fonts.css">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#06100C;color:#EAF3EE;
       font-family:'Inter',sans-serif;overflow:hidden;position:relative}
  .glow1{position:absolute;width:760px;height:760px;left:-220px;top:-320px;border-radius:50%;
         background:radial-gradient(circle,rgba(0,250,130,.42),transparent 66%);filter:blur(70px)}
  .glow2{position:absolute;width:620px;height:620px;right:-180px;bottom:-260px;border-radius:50%;
         background:radial-gradient(circle,rgba(178,154,158,.36),transparent 66%);filter:blur(70px)}
  .grid{position:absolute;inset:0;opacity:.5;
        background-image:linear-gradient(to right,rgba(255,255,255,.04) 1px,transparent 1px),
                         linear-gradient(to bottom,rgba(255,255,255,.04) 1px,transparent 1px);
        background-size:64px 64px}
  .wrap{position:relative;height:100%;padding:74px 80px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:20px}
  .mark{width:82px;height:82px}
  .type{font-family:'Outfit',sans-serif;text-transform:uppercase;line-height:1.05;display:grid}
  .t1,.t2{font-weight:300;letter-spacing:.15em;color:#B29A9E;font-size:20px}
  .t2{letter-spacing:.3em}
  .t3{font-weight:400;font-size:12px;letter-spacing:.22em;color:#00FA82;justify-self:end}
  h1{font-family:'Outfit',sans-serif;font-weight:600;font-size:74px;line-height:1.03;
     letter-spacing:-.032em;max-width:16ch}
  .g{background:linear-gradient(100deg,#00FA82,#8BFFC6);-webkit-background-clip:text;color:transparent}
  .foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .chip{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);
        border-radius:999px;padding:12px 22px;font-size:20px;color:#A9BCB2}
  .chip.hi{border-color:rgba(0,250,130,.4);color:#00FA82}
</style></head><body>
  <div class="glow1"></div><div class="glow2"></div><div class="grid"></div>
  <div class="wrap">
    <div class="top">
      ${MARK}
      <div class="type"><span class="t1">Sports Injury</span><span class="t2">Services</span><span class="t3">Newcastle</span></div>
    </div>
    <h1>Sports injury treatment that <span class="g">fixes the cause</span>.</h1>
    <div class="foot">
      <span class="chip hi">★ 5.0 from 31 reviews</span>
      <span class="chip">Gosforth, Newcastle upon Tyne</span>
      <span class="chip">Book online</span>
    </div>
  </div>
</body></html>`;

const icon = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0}
  body{width:180px;height:180px;background:#06100C;display:grid;place-items:center}
  svg{width:148px;height:148px}
</style></head><body>${MARK}</body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  const p1 = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await p1.setContent(og, { waitUntil: 'networkidle' });
  await p1.screenshot({ path: path.join(OUT, 'og-image.png') });

  const p2 = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await p2.setContent(icon);
  await p2.screenshot({ path: path.join(OUT, 'apple-touch-icon.png') });

  await browser.close();
  console.log('og-image.png + apple-touch-icon.png written to', OUT);
})();
