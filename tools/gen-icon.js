#!/usr/bin/env node
// Generates assets/icon.ico — an original Deadlock-styled target icon
// (brass rings + crosshair on dark green, matching the game's art-deco look).
// Pure Node, zero dependencies: draws an RGBA raster, encodes it as a PNG
// (zlib is built in), and wraps that in a single-image ICO.
// Re-run with: node tools/gen-icon.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

// ---- draw ------------------------------------------------------------------
const px = Buffer.alloc(SIZE * SIZE * 4);
const put = (x, y, r, g, b, a = 255) => {
  const i = (y * SIZE + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
};

const BG = [16, 24, 18];        // deep green-black
const RIM = [43, 58, 46];       // panel green
const BRASS = [212, 169, 74];   // brass
const BRASS_D = [150, 115, 44]; // dark brass
const CREAM = [239, 230, 208];  // parchment

const cx = (SIZE - 1) / 2, cy = (SIZE - 1) / 2;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx, dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx);

    // rounded-square plate
    const inPlate = Math.max(Math.abs(dx), Math.abs(dy)) < 120 &&
      (Math.abs(dx) < 100 || Math.abs(dy) < 100 || (Math.abs(dx) - 100) ** 2 + (Math.abs(dy) - 100) ** 2 < 400);
    if (!inPlate) { put(x, y, 0, 0, 0, 0); continue; }

    let c = BG;
    if (d > 116) c = RIM;                                   // plate rim
    else if (d > 108 && d <= 116) c = BRASS_D;              // outer brass ring
    else if (d > 100 && d <= 108) c = BRASS;
    else if (d > 68 && d <= 76) c = BRASS;                  // middle ring
    else if (d > 62 && d <= 68) c = BRASS_D;
    else if (d <= 22) c = BRASS;                            // bullseye
    else if (d <= 26) c = BRASS_D;

    // art-deco sunburst ticks between middle ring and edge
    if (d > 80 && d < 98) {
      const spokes = 12;
      const t = ((ang / Math.PI / 2) * spokes + spokes) % 1;
      if (t < 0.10 || t > 0.90) c = CREAM;
    }
    // crosshair bars (with a gap around the bullseye)
    const bar = 7;
    if ((Math.abs(dx) <= bar && Math.abs(dy) > 30 && Math.abs(dy) < 100) ||
        (Math.abs(dy) <= bar && Math.abs(dx) > 30 && Math.abs(dx) < 100)) c = CREAM;

    put(x, y, c[0], c[1], c[2], 255);
  }
}

// ---- PNG encode ------------------------------------------------------------
const crcTable = [...Array(256)].map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

// ---- ICO wrap (PNG-in-ICO, supported since Windows Vista) ------------------
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 0; entry[1] = 0;   // 0 = 256px
entry[4] = 1;                 // planes
entry[6] = 32;                // bpp
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);  // offset
const ico = Buffer.concat([header, entry, png]);

const out = path.join(__dirname, '..', 'assets', 'icon.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, ico);
console.log(`Wrote ${out} (${ico.length} bytes)`);
