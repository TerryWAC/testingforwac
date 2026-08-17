#!/usr/bin/env node
/**
 * Turns raw photographs into web-ready WebP.
 *
 *   node src/optimise-photos.js <source-dir>
 *
 * Drop the originals straight off a phone or camera into a folder, name each
 * one after the slot it belongs in (`jack-portrait.jpg`, `clinic-room.png` …),
 * run this, and the optimised file lands in site/assets/img/ ready for the
 * next build.
 *
 * There is no image library in this environment — no sharp, no ImageMagick, no
 * PIL — but there is a headless Chromium for the test suite, and a browser is a
 * perfectly good image pipeline: decode, draw to a canvas at the target size,
 * re-encode as WebP. It handles every format the browser can open, which is
 * every format a client is realistically going to send.
 *
 * Photographs are the heaviest thing on a page by an order of magnitude, so the
 * cap matters more than the quality dial: nothing here is displayed wider than
 * about 560 CSS pixels, so 1200px covers a 2× screen with room to spare and
 * anything beyond that is bytes nobody sees.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = path.join(__dirname, '..', 'site', 'assets', 'img');

const MAX_EDGE = 1200; // Longest side, in pixels.
const QUALITY = 0.82; // WebP quality. Above ~0.85 the file grows fast for no visible gain.

const SRC_EXT = /\.(jpe?g|png|webp|avif|gif|bmp)$/i;

/**
 * Per-slot white balance, 0 (leave alone) to 1 (fully neutral grey-world).
 *
 * Photos taken in a room lit by tungsten or warm LED come out orange, which is
 * invisible on a phone and glaring next to a cool dark page — on a portrait it
 * reads as an unhealthy skin tone, which is the last thing a clinic wants.
 *
 * Correction is deliberately partial. Grey-world assumes the average of a scene
 * is neutral; on a portrait, where a face fills the frame, that assumption is
 * wrong and pushing all the way there drains the life out of the skin. Half way
 * removes the cast and keeps the person looking like a person.
 *
 * Opt in per slot rather than applying it to everything: correcting a photo
 * that was already fine is how you make it worse.
 */
const WHITE_BALANCE = {
  'jack-portrait': 0.5,
};

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: node src/optimise-photos.js <source-dir>');
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    console.error(`No such directory: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => SRC_EXT.test(f));
  if (!files.length) {
    console.error(`No images found in ${dir}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();

  console.log('\n=== OPTIMISE PHOTOS ===');
  let total = 0;

  for (const file of files.sort()) {
    const src = path.join(dir, file);
    const slot = path.basename(file, path.extname(file));
    const raw = fs.readFileSync(src);
    const mime =
      { '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif' }[
        path.extname(file).toLowerCase()
      ] || 'image/jpeg';

    const result = await page.evaluate(
      async ({ dataUrl, maxEdge, quality, balance }) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // Best available resampling — the default is noticeably worse on a
        // large downscale, which is exactly what every one of these is.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        let shift = null;
        if (balance > 0) {
          const px = ctx.getImageData(0, 0, w, h);
          const d = px.data;
          let r = 0;
          let g = 0;
          let bl = 0;
          for (let i = 0; i < d.length; i += 4) {
            r += d[i];
            g += d[i + 1];
            bl += d[i + 2];
          }
          const n = d.length / 4;
          const avg = [r / n, g / n, bl / n];
          const grey = (avg[0] + avg[1] + avg[2]) / 3;

          // Scale each channel towards neutral, damped by `balance`.
          const gain = avg.map((c) => 1 + balance * (grey / c - 1));
          shift = gain.map((x) => x.toFixed(3));

          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, d[i] * gain[0]);
            d[i + 1] = Math.min(255, d[i + 1] * gain[1]);
            d[i + 2] = Math.min(255, d[i + 2] * gain[2]);
          }
          ctx.putImageData(px, 0, 0);
        }

        return {
          w,
          h,
          srcW: img.naturalWidth,
          srcH: img.naturalHeight,
          shift,
          out: canvas.toDataURL('image/webp', quality),
        };
      },
      {
        dataUrl: `data:${mime};base64,${raw.toString('base64')}`,
        maxEdge: MAX_EDGE,
        quality: QUALITY,
        balance: WHITE_BALANCE[slot] || 0,
      }
    );

    if (!result.out.startsWith('data:image/webp')) {
      console.error(`  ${slot}: browser refused to encode WebP — skipped`);
      continue;
    }

    const bytes = Buffer.from(result.out.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, `${slot}.webp`), bytes);
    total += bytes.length;

    const before = (raw.length / 1024).toFixed(0);
    const after = (bytes.length / 1024).toFixed(0);
    const resized =
      result.w !== result.srcW ? `${result.srcW}×${result.srcH} → ${result.w}×${result.h}` : `${result.w}×${result.h}`;
    const wb = result.shift ? `  white balance ×${result.shift.join('/')}` : '';
    console.log(`  ${slot.padEnd(16)} ${resized.padEnd(22)} ${before} kB → ${after} kB${wb}`);
  }

  await browser.close();
  console.log(`\n  ${(total / 1024).toFixed(0)} kB written to site/assets/img\n`);
  console.log('  Run `npm run build` to pick them up.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
