const fs = require('fs');
const path = require('path');

const { site, nav, treatments, reviewCount, offer } = require('./content');
const { icon, stars } = require('./icons');

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const addr = site.address;
const addressOneLine = `${addr.venue}, ${addr.street}, ${addr.locality}, ${addr.region} ${addr.postcode}`;

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

const logoMark = `<svg class="logo-mark" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
  <mask id="jl-mask-{id}">
    <circle cx="100" cy="100" r="96" fill="#fff"/>
    <path d="M62 30 H88 V116 C88 141 69 156 46 156 C32 156 21 151 13 143 L27 122 C32 128 38 131 45 131 C55 131 62 125 62 113 Z" fill="#000"/>
    <path d="M106 30 H132 V126 H192 V152 H106 Z" fill="#000"/>
  </mask>
  <circle class="logo-disc" cx="100" cy="100" r="96" fill="currentColor" mask="url(#jl-mask-{id})"/>
</svg>`;

function logo(id = 'a', href = 'index.html', extraClass = '') {
  return `<a class="logo ${extraClass}" href="${href}" aria-label="${esc(site.name)} — home">
    ${logoMark.replace(/\{id\}/g, id)}
    <span class="logo-type">
      <span class="logo-line-1">Sports Injury</span>
      <span class="logo-line-2">Services</span>
      <span class="logo-line-3">Newcastle</span>
    </span>
  </a>`;
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

function localBusinessSchema() {
  const openSpec = site.hours
    .filter((h) => !h.closed)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${h.day}`,
      opens: h.open,
      closes: h.close,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': ['MedicalBusiness', 'HealthAndBeautyBusiness', 'SportsActivityLocation'],
    '@id': `${site.origin}/#clinic`,
    name: site.name,
    alternateName: 'JL Sports Injury Services',
    description:
      'Sports injury clinic in Gosforth, Newcastle upon Tyne offering injury assessment, sports massage, deep tissue massage, medical acupuncture, electrotherapy, ultrasound therapy and gym-based rehabilitation.',
    url: site.origin,
    telephone: site.phone,
    email: site.email,
    foundingDate: site.founded,
    priceRange: '££',
    currenciesAccepted: 'GBP',
    paymentAccepted: 'Cash, Credit Card, Debit Card',
    logo: `${site.origin}/assets/img/logo-mark.svg`,
    image: `${site.origin}/assets/img/og-image.png`,
    address: {
      '@type': 'PostalAddress',
      name: addr.venue,
      streetAddress: `${addr.venue}, ${addr.street}`,
      addressLocality: addr.locality,
      addressRegion: addr.region,
      postalCode: addr.postcode,
      addressCountry: addr.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: addr.lat, longitude: addr.lng },
    hasMap: site.directionsUrl,
    openingHoursSpecification: openSpec,
    areaServed: site.areasServed.map((a) => ({ '@type': 'Place', name: a })),
    sameAs: [
      site.google.profileUrl,
      site.social.facebook,
      site.social.instagram,
      site.bookingUrl,
    ],
    founder: {
      '@type': 'Person',
      name: site.practitioner,
      jobTitle: 'Sports Injury Therapist',
    },
    potentialAction: {
      '@type': 'ReserveAction',
      name: 'Book an appointment',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: site.bookingUrl,
        inLanguage: 'en-GB',
        actionPlatform: [
          'https://schema.org/DesktopWebPlatform',
          'https://schema.org/MobileWebPlatform',
        ],
      },
      result: { '@type': 'Reservation', name: 'Appointment' },
    },
    makesOffer: treatments.map((t) => ({
      '@type': 'Offer',
      name: t.title,
      description: t.summary,
      price: String(t.price),
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${site.origin}/${t.slug}.html`,
    })),
  };
}

function breadcrumbSchema(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: `${site.origin}/${c.href === 'index.html' ? '' : c.href}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function header(current) {
  const items = nav
    .map((item) => {
      const active =
        item.href === current || (item.children || []).some((c) => c.href === current);
      if (!item.children) {
        return `<li><a class="nav-link${active ? ' is-active' : ''}" href="${item.href}">${esc(
          item.label
        )}</a></li>`;
      }
      const sub = item.children
        .map(
          (c) => `<li><a class="mega-item${c.href === current ? ' is-active' : ''}" href="${c.href}">
            <span class="mega-icon">${icon(c.icon)}</span>
            <span class="mega-text"><strong>${esc(c.label)}</strong><em>${esc(c.summary)}</em></span>
          </a></li>`
        )
        .join('');
      return `<li class="has-mega">
        <a class="nav-link${active ? ' is-active' : ''}" href="${item.href}">
          ${esc(item.label)} ${icon('chevron', 'chev')}
        </a>
        <div class="mega" role="group" aria-label="Treatments">
          <ul class="mega-grid">${sub}</ul>
          <div class="mega-foot">
            <a class="mega-all" href="services.html">All treatments &amp; prices ${icon('arrow')}</a>
          </div>
        </div>
      </li>`;
    })
    .join('');

  // The promo lives inside the fixed header and collapses once you scroll,
  // so it is in front of everyone on arrival without permanently eating the
  // top of every screen.
  const promo = offer.active
    ? `<div class="promo">
    <div class="shell promo-inner">
      <p>${esc(offer.short)} with code <code>${esc(offer.code)}</code> at online checkout</p>
      <a class="promo-cta" href="offers.html">See the offer ${icon('arrow')}</a>
    </div>
  </div>`
    : '';

  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header" id="site-header">
  ${promo}
  <div class="shell header-inner">
    ${logo('hdr')}
    <nav class="nav-desktop" aria-label="Primary">
      <ul class="nav-list">${items}</ul>
    </nav>
    <div class="header-actions">
      <a class="btn btn-ghost btn-call" href="tel:${site.phoneHref}">
        ${icon('phone')}<span>${esc(site.phone)}</span>
      </a>
      <a class="btn btn-primary btn-hdr" href="book.html" data-cta="header">Book now</a>
      <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav">
        <span class="nav-toggle-bars"><i></i><i></i><i></i></span>
      </button>
    </div>
  </div>
  <div class="scroll-progress" aria-hidden="true"><span></span></div>
</header>

<div class="mobile-nav" id="mobile-nav" hidden>
  <div class="mobile-nav-panel">
    <nav aria-label="Mobile">
      <ul class="mobile-list">
        ${nav
          .map((item) => {
            if (!item.children)
              return `<li><a href="${item.href}"${
                item.href === current ? ' aria-current="page"' : ''
              }>${esc(item.label)}</a></li>`;
            return `<li>
              <a href="${item.href}">${esc(item.label)}</a>
              <ul class="mobile-sub">${item.children
                .map((c) => `<li><a href="${c.href}">${esc(c.label)}</a></li>`)
                .join('')}</ul>
            </li>`;
          })
          .join('')}
      </ul>
    </nav>
    <div class="mobile-cta">
      <a class="btn btn-primary btn-block" href="book.html" data-cta="mobile-nav">Book an appointment</a>
      <a class="btn btn-ghost btn-block" href="tel:${site.phoneHref}">${icon('phone')} ${esc(
    site.phone
  )}</a>
      <a class="btn btn-ghost btn-block" href="offers.html#vouchers">${icon('tag')} Buy a gift voucher</a>
    </div>
    <p class="mobile-meta">${esc(addressOneLine)}<br>Mon–Thu, 9am–8pm</p>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function footer() {
  const hours = site.hours
    .map(
      (h) =>
        `<div class="hours-row${h.closed ? ' is-closed' : ''}" data-day="${h.day}">
          <span>${h.day.slice(0, 3)}</span>
          <span>${h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
        </div>`
    )
    .join('');

  return `<footer class="site-footer">
  <div class="shell">
    <div class="footer-top">
      <div class="footer-brand">
        ${logo('ftr', 'index.html', 'logo-footer')}
        <p class="footer-blurb">Elite level injury treatment, management and rehabilitation — at a price that works for everyone. Based in Gosforth, Newcastle upon Tyne since ${
          site.founded
        }.</p>
        <div class="footer-social">
          <a href="${site.google.profileUrl}" rel="noopener" target="_blank" aria-label="Google Business Profile">${icon(
    'google'
  )}</a>
          <a href="${site.social.facebook}" rel="noopener" target="_blank" aria-label="Facebook">${icon(
    'facebook'
  )}</a>
          <a href="${site.social.instagram}" rel="noopener" target="_blank" aria-label="Instagram">${icon(
    'instagram'
  )}</a>
        </div>
        <a class="footer-review" href="${site.google.reviewsUrl}" rel="noopener" target="_blank">
          ${stars(5)}<span>Leave a Google review</span>
        </a>
      </div>

      <div class="footer-col">
        <h3>Treatments</h3>
        <ul>${treatments.map((t) => `<li><a href="${t.slug}.html">${esc(t.title)}</a></li>`).join('')}</ul>
      </div>

      <div class="footer-col">
        <h3>Clinic</h3>
        <ul>
          <li><a href="about-us.html">About Jack</a></li>
          <li><a href="price-list.html">Price list</a></li>
          <li><a href="reviews.html">Reviews</a></li>
          <li><a href="offers.html">Offers</a></li>
          <li><a href="offers.html#vouchers">Gift vouchers</a></li>
          <li><a href="contact.html">Contact &amp; directions</a></li>
          <li><a href="book.html">Book an appointment</a></li>
          <li><a href="privacy-policy.html">Privacy policy</a></li>
        </ul>
      </div>

      <div class="footer-col footer-contact">
        <h3>Find us</h3>
        <address>
          <a class="footer-line" href="${site.directionsUrl}" rel="noopener" target="_blank">
            ${icon('pin')}<span>${esc(addr.venue)}<br>${esc(addr.street)}, ${esc(
    addr.locality
  )}<br>${esc(addr.region)} ${esc(addr.postcode)}</span>
          </a>
          <a class="footer-line" href="tel:${site.phoneHref}">${icon('phone')}<span>${esc(
    site.phone
  )}</span></a>
          <a class="footer-line" href="mailto:${site.email}">${icon('mail')}<span>${esc(
    site.email
  )}</span></a>
        </address>
        <div class="footer-hours">${hours}</div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>&copy; <span data-year>${new Date().getFullYear()}</span> ${esc(
    site.name
  )}. All rights reserved.</p>
      <p class="footer-areas">Serving ${site.areasServed.slice(0, 6).join(' · ')}</p>
    </div>
  </div>
</footer>

<div class="cta-bar" id="cta-bar" aria-hidden="false">
  <div class="cta-bar-inner">
    <div class="cta-bar-text">
      <strong>Book your appointment</strong>
      <span>${stars(5)} Rated ${site.reviews.rating} from ${reviewCount}</span>
    </div>
    <div class="cta-bar-actions">
      <a class="btn btn-ghost btn-sm" href="tel:${site.phoneHref}">${icon('phone')}<span class="sr-only">Call ${esc(
    site.phone
  )}</span></a>
      <a class="btn btn-primary btn-sm" href="book.html" data-cta="sticky">Book now</a>
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Google Analytics + consent
//
// GA4 sets cookies, so under UK GDPR/PECR it needs consent before it loads.
// Nothing is requested from Google until the visitor accepts; if no
// measurement ID is configured, neither the script nor the banner exists.
// ---------------------------------------------------------------------------

function analytics() {
  const id = site.google.analyticsId;
  if (!id) return '';

  return `<script>
(function () {
  var ID = ${JSON.stringify(id)};
  var KEY = 'jl-consent';
  var banner;

  function load() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', ID, { anonymize_ip: true });
  }

  function decide(accepted) {
    try { localStorage.setItem(KEY, accepted ? 'yes' : 'no'); } catch (e) {}
    if (banner) banner.remove();
    if (accepted) load();
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'yes') { load(); return; }
  if (saved === 'no') return;

  document.addEventListener('DOMContentLoaded', function () {
    banner = document.createElement('div');
    banner.className = 'consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookies');
    banner.innerHTML =
      '<p>We use Google Analytics to see which pages help people find treatment. ' +
      'Nothing is loaded until you choose. <a href="privacy-policy.html">Privacy policy</a></p>' +
      '<div class="consent-actions">' +
      '<button class="btn btn-ghost btn-sm" type="button" data-consent="no">Decline</button>' +
      '<button class="btn btn-primary btn-sm" type="button" data-consent="yes">Accept</button>' +
      '</div>';
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (b) decide(b.getAttribute('data-consent') === 'yes');
    });
    document.body.appendChild(banner);
  });
})();
</script>`;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/**
 * @param {object} o
 * @param {string} o.slug      output filename, e.g. "index.html"
 * @param {string} o.title     <title>
 * @param {string} o.desc      meta description
 * @param {string} o.body      page markup
 * @param {object[]} [o.schema] extra JSON-LD blocks
 * @param {string} [o.bodyClass]
 * @param {boolean} [o.noindex]
 */
function page(o) {
  const url = `${site.origin}/${o.slug === 'index.html' ? '' : o.slug}`;
  const schemas = [localBusinessSchema(), ...(o.schema || [])];

  // Per-page share card when one has been generated, else the site-wide one.
  const cardName = `og-${o.slug.replace('.html', '')}.png`;
  const cardExists = fs.existsSync(path.join(__dirname, '..', 'site', 'assets', 'img', cardName));
  const ogImage = `${site.origin}/assets/img/${cardExists ? cardName : 'og-image.png'}`;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${url}">
${o.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">'}
${
  site.google.searchConsoleVerification
    ? `<meta name="google-site-verification" content="${esc(site.google.searchConsoleVerification)}">`
    : ''
}

<meta name="theme-color" content="#06100C">
<meta name="format-detection" content="telephone=no">
<meta name="geo.region" content="GB-NET">
<meta name="geo.placename" content="Gosforth, Newcastle upon Tyne">
<meta name="geo.position" content="${addr.lat};${addr.lng}">
<meta name="ICBM" content="${addr.lat}, ${addr.lng}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(site.name)} — sports injury clinic in Gosforth, Newcastle">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${ogImage}">

<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">

<link rel="preload" as="font" type="font/woff2" href="assets/fonts/outfit-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/inter-latin.woff2" crossorigin>
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/site.css">

${schemas
  .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
  .join('\n')}
</head>
<body class="${[o.bodyClass, offer.active ? 'has-promo' : ''].filter(Boolean).join(' ')}">
${header(o.slug)}
<main id="main">
${o.body}
</main>
${footer()}
<script src="assets/js/site.js" defer></script>
${o.slug === 'book.html' ? '<script src="assets/js/booking.js" defer></script>' : ''}
${analytics()}
</body>
</html>
`;
}

module.exports = {
  page,
  esc,
  logo,
  header,
  footer,
  breadcrumbSchema,
  addressOneLine,
};
