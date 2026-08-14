#!/usr/bin/env node
/**
 * Static site build.
 *
 *   node src/build.js
 *
 * Reads src/content.js, writes plain HTML into site/. No dependencies, no
 * framework — the output is deployable to any static host as-is.
 */

const fs = require('fs');
const path = require('path');

const { site, treatments } = require('./content');
const { page } = require('./layout');
const { pages } = require('./pages');

const OUT = path.join(__dirname, '..', 'site');

function write(file, contents) {
  const target = path.join(OUT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  return contents.length;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const all = pages();
let total = 0;

for (const p of all) {
  const bytes = write(p.slug, page(p));
  total += bytes;
  console.log(`  ${p.slug.padEnd(28)} ${(bytes / 1024).toFixed(1)} kB`);
}

// ---------------------------------------------------------------------------
// sitemap.xml
// ---------------------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);

const priority = (slug) => {
  if (slug === 'index.html') return '1.0';
  if (slug === 'book.html') return '0.9';
  if (slug === 'services.html') return '0.9';
  if (treatments.some((t) => `${t.slug}.html` === slug)) return '0.8';
  if (slug === 'contact.html' || slug === 'about-us.html') return '0.7';
  return '0.3';
};

const urls = all
  .filter((p) => !p.noindex)
  .map((p) => {
    const loc = `${site.origin}/${p.slug === 'index.html' ? '' : p.slug}`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.slug === 'index.html' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${priority(p.slug)}</priority>
  </url>`;
  })
  .join('\n');

write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
);

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

write(
  'robots.txt',
  `User-agent: *
Allow: /

Sitemap: ${site.origin}/sitemap.xml
`
);

// ---------------------------------------------------------------------------
// Web app manifest
// ---------------------------------------------------------------------------

write(
  'site.webmanifest',
  JSON.stringify(
    {
      name: site.name,
      short_name: 'J.L. Sports Injury',
      description: `Sports injury clinic in ${site.address.locality}, ${site.address.region}.`,
      start_url: '/',
      display: 'standalone',
      background_color: '#06100C',
      theme_color: '#06100C',
      icons: [
        { src: '/assets/img/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/assets/img/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    null,
    2
  )
);

// ---------------------------------------------------------------------------
// Host config — works on Netlify, and harmless elsewhere
// ---------------------------------------------------------------------------

write(
  '_headers',
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  Cache-Control: public, max-age=604800
`
);

write('_redirects', `/*  /404.html  404\n`);

console.log(`\n  ${all.length} pages · ${(total / 1024).toFixed(0)} kB HTML · sitemap, robots, manifest written`);
console.log(`  Output: ${OUT}\n`);
