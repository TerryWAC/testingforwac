const fs = require('fs');
const path = require('path');

const {
  site, treatments, steps, credentials, faqs, trustPoints,
} = require('./content');
const { icon, stars } = require('./icons');
const { esc, breadcrumbSchema, addressOneLine } = require('./layout');

const addr = site.address;

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

const IMG_DIR = path.join(__dirname, '..', 'site', 'assets', 'img');

// ---------------------------------------------------------------------------
// Placeholder artwork
//
// Contour lines — the visual language of body mapping and movement. Generated
// deterministically from the slot name so each position gets its own pattern
// and the output is stable between builds.
// ---------------------------------------------------------------------------

function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, deterministic PRNG. */
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function contourArt(name) {
  const rand = rng(seedFrom(name));
  const W = 400;
  const H = 400;
  const LINES = 26;
  const lines = [];

  const baseAmp = 26 + rand() * 20;
  const baseFreq = 1.1 + rand() * 0.9;
  const phase0 = rand() * Math.PI * 2;
  const skew = (rand() - 0.5) * 40;

  for (let i = 0; i < LINES; i++) {
    const t = i / (LINES - 1);
    // Lines bunch towards the middle, the way contours crowd on a slope.
    const y = -40 + t * (H + 80);
    const swell = Math.sin(t * Math.PI); // 0 at edges, 1 in the middle
    const amp = baseAmp * (0.35 + swell * 0.95);
    const freq = baseFreq * (0.85 + swell * 0.4);
    const phase = phase0 + t * 2.4;

    let d = '';
    for (let x = -20; x <= W + 20; x += 20) {
      const px = x / W;
      const py =
        y +
        Math.sin(px * Math.PI * freq + phase) * amp +
        Math.sin(px * Math.PI * freq * 2.7 + phase * 1.6) * amp * 0.22 +
        px * skew;
      d += (d ? ' L' : 'M') + x.toFixed(0) + ' ' + py.toFixed(1);
    }

    const accent = i % 7 === 3;
    lines.push(
      `<path d="${d}" stroke="${accent ? 'var(--green)' : 'currentColor'}" stroke-width="${
        accent ? 1.5 : 1
      }" opacity="${(accent ? 0.5 : 0.16 + swell * 0.2).toFixed(2)}"/>`
    );
  }

  return `<svg class="contours" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"
    fill="none" stroke-linecap="round" aria-hidden="true">${lines.join('')}</svg>`;
}

/** First existing file for this slot, or null while it is still a placeholder. */
function findPhoto(name) {
  for (const ext of ['webp', 'jpg', 'jpeg', 'png', 'avif']) {
    if (fs.existsSync(path.join(IMG_DIR, `${name}.${ext}`))) return `${name}.${ext}`;
  }
  return null;
}

/**
 * A photo position.
 *
 * Drop `<name>.jpg` (or .webp/.png) into site/assets/img/, run `npm run build`,
 * and the photograph replaces the branded placeholder. No markup to edit — and
 * no broken request while the slot is still empty.
 */
const photo = (name, alt) => {
  const file = findPhoto(name);
  const placeholder = `<div class="photo-slot" data-photo="${name}">
  ${contourArt(name)}
  <svg class="logo-mark" viewBox="0 0 200 200" aria-hidden="true">
    <mask id="ph-${name}"><circle cx="100" cy="100" r="96" fill="#fff"/>
      <path d="M62 30 H88 V116 C88 141 69 156 46 156 C32 156 21 151 13 143 L27 122 C32 128 38 131 45 131 C55 131 62 125 62 113 Z" fill="#000"/>
      <path d="M106 30 H132 V126 H192 V152 H106 Z" fill="#000"/>
    </mask>
    <circle cx="100" cy="100" r="96" fill="var(--green)" mask="url(#ph-${name})"/>
  </svg>
</div>`;

  if (!file) return `${placeholder}\n<!-- photo slot: add site/assets/img/${name}.jpg and rebuild -->`;

  return `${placeholder}
<img class="photo" src="assets/img/${file}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
};

const treatmentCard = (t) => `<article class="card t-card card-stretch" data-reveal>
  <div class="t-card-top">
    <div class="card-icon">${icon(t.icon)}</div>
    ${t.kicker ? `<span class="t-card-tag">${esc(t.kicker)}</span>` : ''}
  </div>
  <h3><a href="${t.slug}.html">${esc(t.title)}</a></h3>
  <p>${esc(t.summary)}</p>
  <div class="t-card-meta">
    ${t.priceOptions ? '<span>from</span>' : ''}
    <span class="price">£${
      t.priceOptions ? Math.min(...t.priceOptions.map((o) => o.price)) : t.price
    }</span>
    <span class="sep">·</span>
    <span>${t.priceOptions ? `${Math.min(...t.priceOptions.map((o) => o.duration))}–${t.duration}` : t.duration} min</span>
  </div>
  <span class="t-card-link">Read more ${icon('arrow')}</span>
</article>`;

const faqSection = (items = faqs, heading = 'Questions people ask before booking') => `
<section class="section" id="faqs">
  <div class="shell">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">FAQs</span>
      <h2>${esc(heading)}</h2>
      <p class="lead">Anything not covered here, just call or drop a message — you will get a straight answer.</p>
    </div>
    <div class="faq" data-stagger="60">
      ${items
        .map(
          (f, i) => `<div class="faq-item" data-reveal>
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-p-${i}" id="faq-b-${i}">
          <span>${esc(f.q)}</span>${icon('chevron')}
        </button>
        <div class="faq-a" id="faq-p-${i}" role="region" aria-labelledby="faq-b-${i}" aria-hidden="true">
          <div><p>${esc(f.a)}</p></div>
        </div>
      </div>`
        )
        .join('')}
    </div>
  </div>
</section>`;

const ctaBand = (
  title = 'Stop training around it.',
  copy = 'Book an assessment and find out what is actually going on — then get a plan to fix it.'
) => `<section class="section">
  <div class="shell">
    <div class="cta-band" data-reveal="scale">
      <span class="eyebrow" style="justify-content:center">${icon('sparkle')} Book online</span>
      <h2 style="margin-top:1rem">${esc(title)}</h2>
      <p class="lead">${esc(copy)}</p>
      <div class="btn-row">
        <a class="btn btn-primary btn-lg" href="book.html" data-cta="band">Book an appointment ${icon('arrow')}</a>
        <a class="btn btn-ghost btn-lg" href="tel:${site.phoneHref}">${icon('phone')} ${esc(site.phone)}</a>
      </div>
      <p class="cta-band-note">Mon–Thu, 9am–8pm · ${esc(addr.venue)}, ${esc(addr.locality)} · No referral needed</p>
    </div>
  </div>
</section>`;

const marquee = () => `<div class="marquee" aria-hidden="true">
  <div class="marquee-track">
    <div class="marquee-group">
      ${credentials.map((c) => `<span class="marquee-item">${esc(c)}</span>`).join('')}
    </div>
  </div>
</div>`;

const crumbs = (items) => `<nav class="crumbs" aria-label="Breadcrumb">
  ${items
    .map((c, i) =>
      i === items.length - 1
        ? `<span aria-current="page">${esc(c.label)}</span>`
        : `<a href="${c.href}">${esc(c.label)}</a><span class="sep">/</span>`
    )
    .join('')}
</nav>`;

const heroBg = () => `<div class="hero-bg" aria-hidden="true">
  <span class="blob blob-1"></span><span class="blob blob-2"></span><span class="blob blob-3"></span>
</div>
<div class="grid-lines" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>`;

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function home() {
  const featured = treatments.filter((t) => t.featured);

  const body = `
<section class="hero">
  ${heroBg()}
  <div class="shell">
    <div class="hero-grid">
      <div class="hero-copy">
        <span class="eyebrow" data-hero style="--d:0ms">
          ${icon('pin')} Gosforth · Newcastle upon Tyne · Est. ${site.founded}
        </span>
        <h1 class="split-lines" data-hero style="--d:80ms">
          Sports Injury Clinic &amp;<br><span class="grad">Sports Massage</span> in Gosforth, Newcastle
        </h1>
        <p class="lead" data-hero style="--d:170ms">
          Injury assessment, sports massage, deep tissue massage, medical acupuncture, electrotherapy,
          ultrasound therapy and gym-based rehabilitation — elite level treatment from a therapist with
          ten years in professional rugby. <strong>No referral needed. Book online in 60 seconds.</strong>
        </p>
        <div class="btn-row" data-hero style="--d:250ms">
          <a class="btn btn-primary btn-lg" href="book.html" data-cta="hero">Book an appointment ${icon('arrow')}</a>
          <a class="btn btn-ghost btn-lg" href="tel:${site.phoneHref}">${icon('phone')} ${esc(site.phone)}</a>
        </div>
        <div class="hero-badges" data-hero style="--d:330ms">
          <span class="badge badge-rating">${stars(5)} ${site.reviews.rating} from ${site.reviews.count} reviews</span>
          <span class="badge">${icon('check')} No referral needed</span>
          <span class="badge">${icon('clock')} Mon–Thu, 9am–8pm</span>
          <span class="badge">${icon('tag')} From £30</span>
        </div>
      </div>

      <div class="hero-visual" data-hero style="--d:290ms">
        <div class="hero-card">
          <div class="hero-card-head">
            <h2>Book in 60 seconds</h2>
            <span class="pill"><span class="pill-dot"></span><span data-open-now>Online</span></span>
          </div>
          <p class="tiny muted">Tap what you need — pick a time on the next screen. No deposit.</p>
          <div class="quick-list">
            ${featured
              .map(
                (t) => `<a class="quick-item" href="book.html?treatment=${t.slug}">
              ${icon(t.icon)}
              <span class="quick-item-text">
                <strong>${esc(t.title)}</strong>
                <span>${
                  t.priceOptions
                    ? `${Math.min(...t.priceOptions.map((o) => o.duration))}–${t.duration} minutes`
                    : `${t.duration} minutes`
                }</span>
              </span>
              <span class="quick-item-price">${
                t.priceOptions
                  ? `from £${Math.min(...t.priceOptions.map((o) => o.price))}`
                  : `£${t.price}`
              }</span>
            </a>`
              )
              .join('')}
          </div>
          <a class="btn btn-primary btn-block" href="book.html" data-cta="hero-card">Choose a time ${icon('arrow')}</a>
          <p class="tiny muted" style="text-align:center">Mon–Thu, 9am–8pm · ${esc(addr.venue)}, ${esc(
    addr.locality
  )}</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="offer-strip" aria-label="Treatments and prices">
  <div class="shell">
    <div class="offer-head">
      <h2>What Jack offers</h2>
      <a class="btn-link" href="services.html">All treatments &amp; prices ${icon('arrow')}</a>
    </div>
    <div class="offer-grid" data-stagger="55">
      ${treatments
        .map(
          (t) => `<a class="offer" href="book.html?treatment=${t.slug}" data-reveal>
        <span class="offer-icon">${icon(t.icon)}</span>
        <span class="offer-name">${esc(t.title)}</span>
        <span class="offer-meta">${
          t.priceOptions
            ? `from £${Math.min(...t.priceOptions.map((o) => o.price))} · ${Math.min(
                ...t.priceOptions.map((o) => o.duration)
              )}–${t.duration} min`
            : `£${t.price} · ${t.duration} min`
        }</span>
        <span class="offer-go">Book ${icon('arrow')}</span>
      </a>`
        )
        .join('')}
    </div>
  </div>
</section>

${marquee()}

<section class="section">
  <div class="shell">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Why J.L.</span>
      <h2>Professional sport standards, on your high street.</h2>
      <p class="lead">
        J.L. Sports Injury Services was set up in ${site.founded} with one aim: make the standard of care
        found inside professional clubs available to everyone in Newcastle.
      </p>
    </div>
    <div class="grid grid-4" data-stagger="90">
      ${trustPoints
        .map(
          (t) => `<article class="card" data-reveal>
        <div class="card-icon">${icon(t.icon)}</div>
        <h3>${esc(t.h)}</h3>
        <p>${esc(t.p)}</p>
      </article>`
        )
        .join('')}
    </div>
  </div>
</section>

<section class="section" id="treatments">
  <div class="shell">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Treatments</span>
      <h2>Everything you need under one roof.</h2>
      <p class="lead">
        From a one-off sports massage to a full rehabilitation programme — each treatment is chosen for
        your injury, not sold from a menu.
      </p>
    </div>
    <div class="grid grid-3" data-stagger="70">
      ${treatments.map(treatmentCard).join('')}
    </div>
    <div class="btn-row" style="margin-top:2.5rem" data-reveal>
      <a class="btn btn-outline" href="services.html">All treatments &amp; prices ${icon('arrow')}</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="shell">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow" data-reveal>Meet your therapist</span>
        <h2 data-reveal>Ten years in practice. Two professional clubs. One clinic in Gosforth.</h2>
        <p class="lead" data-reveal>
          Jack Laurie has been practising since 2015, with experience in elite Rugby Union and Rugby
          League at Leicester Tigers and Castleford Tigers R.L.F.C. before moving into private practice
          and setting up J.L. Sports Injury Services.
        </p>
        <ul class="check-list" data-reveal>
          <li>${icon('check')}<span>Specialism in treating neuromusculoskeletal injuries</span></li>
          <li>${icon('check')}<span>Injury management using state of the art gym and rehab equipment</span></li>
          <li>${icon('check')}<span>Particularly passionate about gym-based rehabilitation programmes</span></li>
          <li>${icon('check')}<span>Treats everyone from county athletes to people who have never set foot in a gym</span></li>
        </ul>
        <div class="btn-row" data-reveal>
          <a class="btn btn-ghost" href="about-us.html">More about Jack ${icon('arrow')}</a>
        </div>
      </div>
      <div class="split-media" data-reveal="right">
        <div class="frame frame-glow">
          ${photo('jack-portrait', 'Jack Laurie, sports injury therapist at J.L. Sports Injury Services in Gosforth, Newcastle')}
          <div class="frame-caption">
            ${icon('shield')}
            <span><b>Jack Laurie</b><span>Sports Injury Therapist · Est. ${site.founded}</span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="shell">
    <div class="section-head center" data-reveal>
      <span class="eyebrow" style="justify-content:center">How it works</span>
      <h2>Four steps from injured to back in training.</h2>
    </div>
    <div class="steps" data-stagger="100">
      ${steps
        .map(
          (s) => `<div class="step" data-reveal>
        <div class="step-num">${s.n}</div>
        <h3>${esc(s.h)}</h3>
        <p>${esc(s.p)}</p>
      </div>`
        )
        .join('')}
    </div>
  </div>
</section>

<section class="section-tight">
  <div class="shell">
    <div class="stats" data-reveal>
      <div class="stat"><b data-count="10" data-suffix="+">0</b><span>Years in practice</span></div>
      <div class="stat"><b>${site.founded}</b><span>Serving Gosforth</span></div>
      <div class="stat"><b data-count="5" data-decimals="1" data-suffix="★">0</b><span>From ${site.reviews.count} reviews</span></div>
      <div class="stat"><b data-count="7">0</b><span>Treatments available</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="shell">
    <div class="rating-panel" data-reveal>
      <div class="rating-score">
        <b>${site.reviews.rating}</b>
        ${stars(5)}
        <small>${site.reviews.count} reviews</small>
      </div>
      <div class="rating-copy">
        <h3>Five stars, everywhere clients leave them.</h3>
        <p class="muted tiny" style="margin-top:0.5rem">
          Verified across Google, Fresha and Facebook by clients from across Newcastle and North Tyneside.
        </p>
      </div>
      <div class="rating-platforms">
        <a class="platform" href="${site.bookingUrl}" target="_blank" rel="noopener">${icon('star')} Fresha</a>
        <a class="platform" href="${site.social.facebook}" target="_blank" rel="noopener">${icon('facebook')} Facebook</a>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="shell">
    <div class="split">
      <div class="split-media" data-reveal="left">
        <div class="map-card">
          <svg class="map-art" viewBox="0 0 600 420" aria-hidden="true">
            <g stroke="rgba(255,255,255,0.10)" stroke-width="1.5" fill="none">
              <path d="M-20 120 H620 M-20 250 H620 M-20 340 H620"/>
              <path d="M110 -20 V440 M270 -20 V440 M430 -20 V440"/>
            </g>
            <g stroke="rgba(0,250,130,0.28)" stroke-width="3" fill="none">
              <path d="M-20 190 H620"/><path d="M350 -20 V440"/>
            </g>
            <g fill="rgba(255,255,255,0.045)">
              <rect x="140" y="60" width="90" height="45" rx="5"/>
              <rect x="300" y="70" width="70" height="60" rx="5"/>
              <rect x="450" y="230" width="100" height="70" rx="5"/>
              <rect x="150" y="280" width="80" height="50" rx="5"/>
            </g>
          </svg>
          <div class="map-pulse" aria-hidden="true"></div>
          <div class="map-pin" aria-hidden="true">${icon('pin')}</div>
          <div class="map-overlay">
            <div>
              <b>${esc(addr.venue)}</b>
              <span>${esc(addr.street)}, ${esc(addr.locality)} ${esc(addr.postcode)}</span>
            </div>
            <a class="btn btn-ghost btn-sm" href="${site.directionsUrl}" target="_blank" rel="noopener">Directions</a>
          </div>
        </div>
      </div>
      <div class="split-copy">
        <span class="eyebrow" data-reveal>Find the clinic</span>
        <h2 data-reveal>Inside Hidden Strength, a minute from Gosforth High Street.</h2>
        <p class="lead" data-reveal>
          Being based inside a working gym is deliberate. It means your rehabilitation is loaded, coached
          and progressed on real equipment — instead of handed to you on a sheet of paper.
        </p>
        <ul class="check-list" data-reveal>
          <li>${icon('check')}<span>Parking on site and on surrounding streets</span></li>
          <li>${icon('check')}<span>Short walk from Gosforth High Street and Regent Centre Metro</span></li>
          <li>${icon('check')}<span>Full gym floor available for assessment and rehab</span></li>
        </ul>
        <div class="btn-row" data-reveal>
          <a class="btn btn-ghost" href="contact.html">Contact &amp; directions ${icon('arrow')}</a>
        </div>
      </div>
    </div>
  </div>
</section>

${faqSection()}
${ctaBand()}
`;

  return {
    slug: 'index.html',
    title: 'Sports Injury Clinic & Sports Massage | Gosforth, Newcastle',
    desc:
      'Sports injury clinic in Gosforth, Newcastle. Injury assessment, sports massage, medical acupuncture and gym-based rehab. Rated 5.0 from 31 reviews. Book online.',
    body,
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: site.origin,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

function about() {
  const body = `
<section class="page-head">
  ${heroBg()}
  <div class="shell">
    ${crumbs([{ label: 'Home', href: 'index.html' }, { label: 'About' }])}
    <div class="page-head-grid">
      <div>
        <span class="eyebrow" data-hero>About us</span>
        <h1 data-hero style="--d:80ms">A decade in professional sport, brought home to Gosforth.</h1>
        <p class="lead" data-hero style="--d:160ms">
          J.L. Sports Injury Services was founded in ${site.founded} by ${site.practitioner} and can be
          found in the heart of Gosforth, Newcastle upon Tyne.
        </p>
        <div class="btn-row" data-hero style="--d:240ms" style="margin-top:2rem">
          <a class="btn btn-primary" href="book.html" data-cta="about-head">Book an appointment ${icon('arrow')}</a>
          <a class="btn btn-ghost" href="services.html">See treatments</a>
        </div>
      </div>
      <div class="fact-strip" data-hero style="--d:320ms">
        <span class="badge">${icon('shield')} Leicester Tigers</span>
        <span class="badge">${icon('shield')} Castleford Tigers R.L.F.C.</span>
        <span class="badge">${icon('star')} Practising since 2015</span>
        <span class="badge">${icon('dumbbell')} Gym-based rehab</span>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="shell">
    <div class="split">
      <div class="split-media" data-reveal="left">
        <div class="frame frame-glow">
          ${photo('jack-treating', 'Jack Laurie treating a client at the Gosforth clinic')}
          <div class="frame-caption">
            ${icon('hands')}
            <span><b>Assessment and treatment</b><span>${esc(addr.venue)}, ${esc(addr.locality)}</span></span>
          </div>
        </div>
      </div>
      <div class="split-copy prose">
        <span class="eyebrow" data-reveal>The therapist</span>
        <h2 data-reveal style="margin-top:0.8rem">Jack Laurie</h2>
        <p data-reveal>
          Jack has been practising since 2015, with experience working in elite Rugby Union and Rugby
          League — including time with Castleford Tigers R.L.F.C. and Leicester Tigers — before moving
          into private practice and setting up J.L. Sports Injury Services.
        </p>
        <p data-reveal>
          With a specialism in treating neuromusculoskeletal injuries and over ten years of experience,
          he provides injury management using state of the art gym and rehab equipment alongside proven
          healing technologies.
        </p>
        <p data-reveal>
          Treatment options include sports massage, electrotherapy, ultrasound therapy and medical
          acupuncture — but the part Jack is most passionate about is gym based rehabilitation
          programmes, where an injury stops being managed and starts being solved.
        </p>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="shell">
    <div class="section-head" data-reveal>
      <span class="eyebrow">The idea</span>
      <h2>Elite level care should not be reserved for elite level athletes.</h2>
      <p class="lead">
        Inside a professional club, an injured player is assessed within hours, treated properly and
        rehabilitated under supervision until they are genuinely ready. Outside of it, most people get a
        waiting list and a photocopied exercise sheet. The clinic exists to close that gap.
      </p>
    </div>
    <div class="grid grid-3" data-stagger="90">
      <article class="card" data-reveal>
        <div class="card-icon">${icon('clipboard')}</div>
        <h3>Assessed properly</h3>
        <p>A full hands-on assessment with real physical testing, so you get a diagnosis rather than a guess — and a realistic timescale to go with it.</p>
      </article>
      <article class="card" data-reveal>
        <div class="card-icon">${icon('dumbbell')}</div>
        <h3>Rehabilitated properly</h3>
        <p>Rehab that is loaded and coached on a full gym floor, progressed session by session, so the fix holds when you go back to training.</p>
      </article>
      <article class="card" data-reveal>
        <div class="card-icon">${icon('tag')}</div>
        <h3>Priced properly</h3>
        <p>Affordable, transparent pricing with no packages to sign up to and no pressure to keep coming back once you are better.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="shell">
    <div class="split">
      <div class="split-copy">
        <span class="eyebrow" data-reveal>The clinic</span>
        <h2 data-reveal>Based inside Hidden Strength, Gosforth.</h2>
        <p class="lead" data-reveal>
          The clinic aims to provide elite level injury treatment, management and rehabilitation using
          Hidden Strength Gosforth's state of the art gym equipment and facilities.
        </p>
        <p class="muted" data-reveal>
          That setup is the whole point. Assessment happens on the treatment couch; rehabilitation
          happens ten feet away on the gym floor, with the equipment needed to load a movement properly
          and the coaching to make sure it is being done right.
        </p>
        <ul class="check-list" data-reveal>
          <li>${icon('check')}<span>Full strength and conditioning equipment on site</span></li>
          <li>${icon('check')}<span>Private treatment space for hands-on work</span></li>
          <li>${icon('check')}<span>Parking on site and on surrounding streets</span></li>
          <li>${icon('check')}<span>A minute from Gosforth High Street</span></li>
        </ul>
        <div class="btn-row" data-reveal>
          <a class="btn btn-ghost" href="contact.html">Directions ${icon('arrow')}</a>
        </div>
      </div>
      <div class="split-media" data-reveal="right">
        <div class="frame frame-wide frame-glow">
          ${photo('clinic-gym', 'The gym floor at Hidden Strength, Gosforth, used for rehabilitation')}
        </div>
      </div>
    </div>
  </div>
</section>

${ctaBand(
  'Get an honest answer about your injury.',
  'Book an assessment and find out what is going on, how long it will take, and exactly what needs to happen next.'
)}
`;

  return {
    slug: 'about-us.html',
    title: 'About Jack Laurie | Sports Injury Therapist Newcastle',
    desc:
      'Founded in 2018 by Jack Laurie, bringing elite rugby experience from Leicester Tigers and Castleford Tigers to a sports injury clinic in Gosforth, Newcastle.',
    body,
    schema: [
      breadcrumbSchema([{ label: 'Home', href: 'index.html' }, { label: 'About', href: 'about-us.html' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: site.practitioner,
        jobTitle: 'Sports Injury Therapist',
        worksFor: { '@type': 'Organization', name: site.name, url: site.origin },
        knowsAbout: [
          'Sports injury rehabilitation',
          'Neuromusculoskeletal injuries',
          'Sports massage',
          'Medical acupuncture',
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Services / treatments index
// ---------------------------------------------------------------------------

function services() {
  const priceRows = treatments
    .flatMap((t) => {
      if (t.priceOptions && t.priceOptions.length) {
        return t.priceOptions.map((o, i) => ({
          name: i === 0 ? t.title : '',
          sub: o.label,
          slug: t.slug,
          dur: o.duration,
          price: o.price,
        }));
      }
      return [{ name: t.title, sub: t.priceNote || t.summary, slug: t.slug, dur: t.duration, price: t.price }];
    })
    .map(
      (r) => `<div class="price-row">
      <div class="price-name">
        ${r.name ? `<strong>${esc(r.name)}</strong>` : ''}
        <span>${esc(r.sub)}</span>
      </div>
      <div class="price-dur">${r.dur} min</div>
      <div class="price-amt">£${r.price}</div>
      <a class="btn btn-ghost btn-sm" href="book.html?treatment=${r.slug}">Book</a>
    </div>`
    )
    .join('');

  const body = `
<section class="page-head">
  ${heroBg()}
  <div class="shell">
    ${crumbs([{ label: 'Home', href: 'index.html' }, { label: 'Treatments' }])}
    <div class="page-head-grid">
      <div>
        <span class="eyebrow" data-hero>Treatments</span>
        <h1 data-hero style="--d:80ms">Treatments that get you back to full training.</h1>
        <p class="lead" data-hero style="--d:160ms">
          J.L. Sports Injury Services aims to provide elite level injury treatment, management and
          rehabilitation using Hidden Strength Gosforth's state of the art gym equipment and facilities.
        </p>
      </div>
      <div data-hero style="--d:260ms">
        <div class="btn-row">
          <a class="btn btn-primary" href="book.html" data-cta="services-head">Book online ${icon('arrow')}</a>
          <a class="btn btn-ghost" href="#prices">See prices</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="shell">
    <div class="offer-head" data-reveal>
      <h2>All seven treatments</h2>
      <a class="btn-link" href="#prices">Jump to prices ${icon('arrow')}</a>
    </div>
    <div class="grid grid-3" data-stagger="70">
      ${treatments.map(treatmentCard).join('')}
    </div>
  </div>
</section>

<section class="section" id="prices" style="padding-top:0">
  <div class="shell">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Prices</span>
      <h2>Clear pricing, no packages.</h2>
      <p class="lead">
        Pay for the appointment you have, when you have it. No block bookings to commit to and no
        pressure to keep coming back once you are better.
      </p>
    </div>
    <div class="price-table" data-reveal>
      <div class="price-row is-head">
        <div>Treatment</div><div>Duration</div><div>Price</div><div></div>
      </div>
      ${priceRows}
    </div>
    <p class="price-note">
      Not sure which to book? Start with an injury assessment — it includes treatment in the same
      appointment. ${icon('arrow')}
      <a href="injury-assessment.html" style="color:var(--green)">Read what happens</a>
    </p>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="shell">
    <div class="section-head center" data-reveal>
      <span class="eyebrow" style="justify-content:center">Not sure?</span>
      <h2>Which appointment should you book?</h2>
    </div>
    <div class="grid grid-3" data-stagger="90">
      <article class="card" data-reveal>
        <div class="card-icon">${icon('clipboard')}</div>
        <h3>You are in pain or injured</h3>
        <p>Book an <strong>injury assessment</strong>. You get physical testing, a diagnosis, treatment in the same session and a plan to follow.</p>
        <a class="t-card-link" href="book.html?treatment=injury-assessment">Book assessment ${icon('arrow')}</a>
      </article>
      <article class="card" data-reveal>
        <div class="card-icon">${icon('hands')}</div>
        <h3>You are tight, not injured</h3>
        <p>Book a <strong>sports massage</strong> for a specific area, or a <strong>deep tissue massage</strong> if you want the whole body worked through.</p>
        <a class="t-card-link" href="book.html?treatment=sports-massage">Book massage ${icon('arrow')}</a>
      </article>
      <article class="card" data-reveal>
        <div class="card-icon">${icon('pulse')}</div>
        <h3>You have been seen before</h3>
        <p>Book an <strong>injury treatment</strong> follow-up to carry on where you left off and progress your rehabilitation.</p>
        <a class="t-card-link" href="book.html?treatment=follow-up-treatment">Book follow-up ${icon('arrow')}</a>
      </article>
    </div>
  </div>
</section>

${faqSection(faqs.slice(0, 5), 'Before you book')}
${ctaBand()}
`;

  return {
    slug: 'services.html',
    title: 'Treatments & Prices | Sports Injury Clinic Newcastle',
    desc:
      'Injury assessment, sports massage, deep tissue massage, medical acupuncture, electrotherapy and ultrasound therapy in Gosforth, Newcastle. Clear prices, book online.',
    body,
    schema: [
      breadcrumbSchema([{ label: 'Home', href: 'index.html' }, { label: 'Treatments', href: 'services.html' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Treatments',
        itemListElement: treatments.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.title,
          url: `${site.origin}/${t.slug}.html`,
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Individual treatment page
// ---------------------------------------------------------------------------

function treatmentPage(t) {
  const related = treatments.filter((x) => x.slug !== t.slug).slice(0, 4);

  const priceBlock = t.priceOptions
    ? t.priceOptions
        .map(
          (o) => `<div class="summary-row"><span>${o.duration} minutes</span><strong>£${o.price}</strong></div>`
        )
        .join('')
    : `<div class="summary-row"><span>${t.duration} minutes</span><strong>£${t.price}</strong></div>`;

  const body = `
<section class="page-head">
  ${heroBg()}
  <div class="shell">
    ${crumbs([
      { label: 'Home', href: 'index.html' },
      { label: 'Treatments', href: 'services.html' },
      { label: t.title },
    ])}
    <div class="page-head-grid">
      <div>
        <span class="eyebrow" data-hero>${icon(t.icon)} ${esc(t.nav)}</span>
        <h1 data-hero style="--d:80ms">${esc(t.title)}</h1>
        <p class="lead" data-hero style="--d:160ms">${esc(t.intro)}</p>
      </div>
      <div class="fact-strip" data-hero style="--d:260ms">
        <span class="badge">${icon('clock')} ${t.duration} minutes</span>
        <span class="badge">${icon('tag')} From £${
    t.priceOptions ? Math.min(...t.priceOptions.map((o) => o.price)) : t.price
  }</span>
        <span class="badge">${icon('pin')} ${esc(addr.locality)}, Newcastle</span>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="shell">
    <div class="layout-aside">
      <div class="prose">
        ${t.body
          .map(
            (b) => `<div data-reveal>
          <h2>${esc(b.h)}</h2>
          <p>${esc(b.p)}</p>
        </div>`
          )
          .join('')}

        <div data-reveal>
          <h2>Is this right for you?</h2>
          <p>${esc(t.title)} is commonly the right choice if any of the following sound familiar:</p>
          <ul>
            ${t.goodFor.map((g) => `<li>${esc(g)}</li>`).join('')}
          </ul>
          <p>
            If you are not sure, book an
            <a href="injury-assessment.html">injury assessment</a> instead — it identifies exactly what
            you need and includes treatment in the same appointment.
          </p>
        </div>

        <div class="frame frame-wide frame-glow" data-reveal style="margin-top:2.5rem">
          ${photo(`treatment-${t.slug}`, `${t.title} at J.L. Sports Injury Services, Gosforth, Newcastle`)}
        </div>
      </div>

      <aside class="booking-aside">
        <div class="aside-card">
          <h3>Book ${esc(t.title.toLowerCase())}</h3>
          <div class="aside-price">
            ${t.priceOptions ? '<span>from</span>' : ''}
            <b>£${t.priceOptions ? Math.min(...t.priceOptions.map((o) => o.price)) : t.price}</b>
            ${t.priceOptions ? '' : `<span>· ${t.duration} min</span>`}
          </div>
          ${t.priceNote ? `<p class="tiny muted">${esc(t.priceNote)}</p>` : ''}
          <a class="btn btn-primary btn-block" href="book.html?treatment=${t.slug}" data-cta="treatment-aside">
            Book online ${icon('arrow')}
          </a>
          <a class="btn btn-ghost btn-block" href="tel:${site.phoneHref}">${icon('phone')} Call the clinic</a>
          <div class="aside-meta">
            <div>${icon('clock')}<span>Mon–Thu, 9am–8pm</span></div>
            <div>${icon('pin')}<span>${esc(addr.venue)}, ${esc(addr.locality)}</span></div>
            <div>${icon('check')}<span>No referral needed</span></div>
          </div>
        </div>

        <div class="mini-card">
          <h3>Pricing</h3>
          <div style="display:grid;gap:0.5rem">${priceBlock}</div>
        </div>

        <div class="mini-card">
          <h3>Other treatments</h3>
          <div class="related">
            ${related
              .map((r) => `<a href="${r.slug}.html">${esc(r.title)} ${icon('arrow')}</a>`)
              .join('')}
          </div>
        </div>
      </aside>
    </div>
  </div>
</section>

${ctaBand(
  `Book your ${t.title.toLowerCase()}.`,
  'Pick a time that suits you and get it seen to properly. Mon–Thu, 9am–8pm in Gosforth.'
)}
`;

  return {
    slug: `${t.slug}.html`,
    title: t.metaTitle,
    desc: t.metaDescription,
    body,
    schema: [
      breadcrumbSchema([
        { label: 'Home', href: 'index.html' },
        { label: 'Treatments', href: 'services.html' },
        { label: t.title, href: `${t.slug}.html` },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: t.title,
        description: t.summary,
        serviceType: t.title,
        url: `${site.origin}/${t.slug}.html`,
        provider: { '@id': `${site.origin}/#clinic` },
        areaServed: site.areasServed.map((a) => ({ '@type': 'Place', name: a })),
        offers: {
          '@type': 'Offer',
          price: String(t.price),
          priceCurrency: 'GBP',
          availability: 'https://schema.org/InStock',
          url: `${site.origin}/book.html?treatment=${t.slug}`,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

function book() {
  const bookingData = {
    treatments: treatments.map((t) => ({
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      duration: t.duration,
      price: t.price,
      priceNote: t.priceNote || null,
      priceOptions: t.priceOptions || null,
    })),
    openDays: [1, 2, 3, 4],
    openFrom: 9,
    openTo: 20,
    bookingUrl: site.bookingUrl,
    email: site.email,
    phoneHref: site.phoneHref,
    address: addressOneLine,
  };

  const treatmentOptions = treatments
    .map(
      (t) => `<label class="opt">
      <input type="radio" name="treatment" value="${t.slug}">
      <span class="opt-face">
        <span class="opt-icon">${icon(t.icon)}</span>
        <span class="opt-text">
          <strong>${esc(t.title)}</strong>
          <span>${esc(t.summary)}</span>
        </span>
        <span class="opt-price">£${t.priceOptions ? Math.min(...t.priceOptions.map((o) => o.price)) : t.price}</span>
      </span>
    </label>`
    )
    .join('');

  const summaryPanel = `<div class="summary-panel" data-summary>
    <div class="summary-row"><span>Treatment</span><strong data-sum="treatment">—</strong></div>
    <div class="summary-row"><span>Duration</span><strong data-sum="duration">—</strong></div>
    <div class="summary-row"><span>When</span><strong data-sum="when">—</strong></div>
    <div class="summary-row summary-total"><span>Price</span><strong data-sum="price">—</strong></div>
  </div>`;

  const body = `
<section class="page-head">
  ${heroBg()}
  <div class="shell">
    ${crumbs([{ label: 'Home', href: 'index.html' }, { label: 'Book' }])}
    <div class="page-head-grid">
      <div>
        <span class="eyebrow" data-hero>${icon('calendar')} Book online</span>
        <h1 data-hero style="--d:80ms">Book your appointment.</h1>
        <p class="lead" data-hero style="--d:160ms">
          Four quick steps. Pick your treatment, choose a time that suits you, and you are done —
          no deposit, no waiting for a callback.
        </p>
      </div>
      <div class="fact-strip" data-hero style="--d:260ms">
        <span class="badge badge-rating">${stars(5)} ${site.reviews.rating} from ${site.reviews.count} reviews</span>
        <span class="badge">${icon('check')} No referral needed</span>
        <span class="badge">${icon('clock')} Mon–Thu, 9am–8pm</span>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="shell">
    <div class="layout-aside">
      <div class="booking" id="booking">
        <div class="booking-head">
          <div class="progress">
            <div class="progress-step is-active"><span class="progress-dot">1</span><span class="progress-label">Treatment</span></div>
            <span class="progress-line"></span>
            <div class="progress-step"><span class="progress-dot">2</span><span class="progress-label">Length</span></div>
            <span class="progress-line"></span>
            <div class="progress-step"><span class="progress-dot">3</span><span class="progress-label">Date</span></div>
            <span class="progress-line"></span>
            <div class="progress-step"><span class="progress-dot">4</span><span class="progress-label">Time</span></div>
            <span class="progress-line"></span>
            <div class="progress-step"><span class="progress-dot">5</span><span class="progress-label">Details</span></div>
          </div>
        </div>

        <div class="booking-body">
          <!-- 1 -->
          <div class="booking-step is-active" id="step-treatment">
            <h2>What do you need?</h2>
            <p class="muted">Not sure? Pick the injury assessment — it works out what you need and treats it in the same appointment.</p>
            <div class="opt-grid">${treatmentOptions}</div>
            <div class="booking-nav">
              <span class="spacer"></span>
              <button class="btn btn-primary" type="button" data-next="0" disabled>Continue ${icon('arrow')}</button>
            </div>
          </div>

          <!-- 2 -->
          <div class="booking-step" id="step-duration">
            <h2>How long do you need?</h2>
            <p class="muted" id="duration-intro">Choose your appointment length.</p>
            <div class="opt-grid" id="duration-options"></div>
            <div class="booking-nav">
              <button class="btn btn-ghost" type="button" data-back="1">Back</button>
              <span class="spacer"></span>
              <button class="btn btn-primary" type="button" data-next="1" disabled>Continue ${icon('arrow')}</button>
            </div>
          </div>

          <!-- 3 -->
          <div class="booking-step" id="step-date">
            <h2>Pick a day.</h2>
            <p class="muted">The clinic runs Monday to Thursday, 9am until 8pm.</p>
            <div class="opt-grid opt-grid-4" id="day-options"></div>
            <div class="booking-nav">
              <button class="btn btn-ghost" type="button" data-back="2">Back</button>
              <span class="spacer"></span>
              <button class="btn btn-primary" type="button" data-next="2" disabled>Continue ${icon('arrow')}</button>
            </div>
          </div>

          <!-- 4 -->
          <div class="booking-step" id="step-time">
            <h2>Pick a time.</h2>
            <p class="muted" id="time-intro">Times shown are start times.</p>
            <div class="opt-grid opt-grid-4" id="time-options"></div>
            <div class="booking-nav">
              <button class="btn btn-ghost" type="button" data-back="3">Back</button>
              <span class="spacer"></span>
              <button class="btn btn-primary" type="button" data-next="3" disabled>Continue ${icon('arrow')}</button>
            </div>
          </div>

          <!-- 5 -->
          <div class="booking-step" id="step-details">
            <h2>Your details.</h2>
            <p class="muted">So Jack knows who is coming in and what he is looking at.</p>
            ${summaryPanel}
            <form id="booking-form" novalidate>
              <div class="form-grid">
                <div class="field">
                  <label for="bk-name">Full name</label>
                  <input class="input" type="text" id="bk-name" name="name" autocomplete="name" required>
                  <span class="field-error">Please tell us your name.</span>
                </div>
                <div class="field">
                  <label for="bk-phone">Phone</label>
                  <input class="input" type="tel" id="bk-phone" name="phone" autocomplete="tel" required>
                  <span class="field-error">A contact number is needed to confirm your slot.</span>
                </div>
                <div class="field col-2">
                  <label for="bk-email">Email</label>
                  <input class="input" type="email" id="bk-email" name="email" autocomplete="email" required>
                  <span class="field-error">Please enter a valid email address.</span>
                </div>
                <div class="field col-2">
                  <label for="bk-notes">What is bothering you?</label>
                  <textarea class="textarea" id="bk-notes" name="notes" placeholder="Where is the pain, how long have you had it, and what makes it worse? A couple of lines is plenty."></textarea>
                  <span class="hint">Optional, but it means Jack can plan your appointment before you walk in.</span>
                </div>
                <div class="col-2">
                  <label class="checkbox">
                    <input type="checkbox" name="consent" required>
                    <span>I am happy to be contacted about this appointment, and I have read the <a href="privacy-policy.html" style="color:var(--green)">privacy policy</a>.</span>
                  </label>
                </div>
              </div>
            </form>
            <div class="booking-nav">
              <button class="btn btn-ghost" type="button" data-back="4">Back</button>
              <span class="spacer"></span>
              <button class="btn btn-primary btn-lg" type="button" data-next="4">Confirm booking ${icon('arrow')}</button>
            </div>
          </div>

          <!-- 6 -->
          <div class="booking-step" id="step-done">
            <div class="booking-done">
              <div class="done-mark">${icon('check')}</div>
              <h2>Nearly there, <span data-done-name>there</span>.</h2>
              <p class="lead" style="margin:1rem auto 0">
                Here is your appointment. Send it across using whichever is easiest — Jack will confirm
                it and you will get everything you need by email.
              </p>
              <div style="max-width:32rem;margin:2rem auto 0;text-align:left">${summaryPanel}</div>
              <div class="btn-row" style="justify-content:center">
                <a class="btn btn-primary btn-lg" data-fresha href="${site.bookingUrl}" target="_blank" rel="noopener">
                  Confirm in the diary ${icon('arrow')}
                </a>
                <a class="btn btn-ghost btn-lg" data-mailto href="mailto:${site.email}">${icon('mail')} Send by email</a>
              </div>
              <div class="btn-row" style="justify-content:center;margin-top:0.75rem">
                <a class="btn btn-ghost btn-sm" data-sms href="sms:${site.phoneHref}">${icon('phone')} Text the clinic</a>
                <a class="btn btn-ghost btn-sm" data-ics href="#">${icon('calendar')} Add to calendar</a>
                <button class="btn btn-ghost btn-sm" type="button" data-restart>Start again</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside class="booking-aside">
        <div class="mini-card">
          <h3>What happens next</h3>
          <ul class="mini-list">
            <li>${icon('check')}<span>You will get written confirmation of your time.</span></li>
            <li>${icon('check')}<span>Arrive five minutes early — the clinic is inside Hidden Strength.</span></li>
            <li>${icon('check')}<span>Wear something you can move and be assessed in.</span></li>
            <li>${icon('check')}<span>Payment is taken at the appointment. No deposit needed.</span></li>
          </ul>
        </div>

        <div class="mini-card">
          <h3>Rather just talk to someone?</h3>
          <p>Call the clinic during opening hours and Jack will get you booked in.</p>
          <a class="btn btn-primary btn-block" href="tel:${site.phoneHref}">${icon('phone')} ${esc(site.phone)}</a>
          <a class="btn btn-ghost btn-block" href="contact.html">Send a message</a>
        </div>

        <div class="mini-card">
          <h3>Opening hours</h3>
          <div class="hours-table" style="border:0">
            ${site.hours
              .map(
                (h) => `<div class="hours-row${h.closed ? ' is-closed' : ''}" data-day="${h.day}">
              <span>${h.day}</span><span>${h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
            </div>`
              )
              .join('')}
          </div>
        </div>
      </aside>
    </div>
  </div>
</section>

<script type="application/json" id="booking-data">${JSON.stringify(bookingData)}</script>
`;

  return {
    slug: 'book.html',
    title: 'Book Online | Sports Injury Clinic Gosforth, Newcastle',
    desc:
      'Book a sports massage, injury assessment or treatment at J.L. Sports Injury Services in Gosforth, Newcastle. Mon–Thu 9am–8pm. No referral and no deposit needed.',
    body,
    schema: [
      breadcrumbSchema([{ label: 'Home', href: 'index.html' }, { label: 'Book', href: 'book.html' }]),
    ],
  };
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

function contact() {
  const body = `
<section class="page-head">
  ${heroBg()}
  <div class="shell">
    ${crumbs([{ label: 'Home', href: 'index.html' }, { label: 'Contact' }])}
    <div class="page-head-grid">
      <div>
        <span class="eyebrow" data-hero>Contact</span>
        <h1 data-hero style="--d:80ms">Get in touch with the clinic.</h1>
        <p class="lead" data-hero style="--d:160ms">
          The quickest way to be seen is to book online. If you would rather ask a question first, call,
          text or send a message and you will get a straight answer — usually the same day.
        </p>
      </div>
      <div class="fact-strip" data-hero style="--d:260ms">
        <span class="badge">${icon('clock')} Mon–Thu, 9am–8pm</span>
        <span class="badge">${icon('pin')} ${esc(addr.locality)}, Newcastle</span>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="shell">
    <div class="contact-grid">
      <div>
        <h2 data-reveal style="margin-bottom:1.5rem">Send a message</h2>
        <form id="contact-form" data-email="${site.email}" novalidate data-reveal>
          <div class="form-grid">
            <div class="field">
              <label for="ct-name">Your name</label>
              <input class="input" type="text" id="ct-name" name="name" autocomplete="name" required>
              <span class="field-error">Please tell us your name.</span>
            </div>
            <div class="field">
              <label for="ct-phone">Phone</label>
              <input class="input" type="tel" id="ct-phone" name="phone" autocomplete="tel">
              <span class="hint">Optional</span>
            </div>
            <div class="field col-2">
              <label for="ct-email">Email</label>
              <input class="input" type="email" id="ct-email" name="email" autocomplete="email" required>
              <span class="field-error">Please enter a valid email address.</span>
            </div>
            <div class="field col-2">
              <label for="ct-subject">What is it about?</label>
              <select class="select" id="ct-subject" name="subject">
                <option>Booking an appointment</option>
                <option>Asking about an injury</option>
                <option>Which treatment do I need?</option>
                <option>Rescheduling or cancelling</option>
                <option>Something else</option>
              </select>
            </div>
            <div class="field col-2">
              <label for="ct-message">Message</label>
              <textarea class="textarea" id="ct-message" name="message" required placeholder="Tell us what is going on — where it hurts, how long you have had it, and what you are trying to get back to."></textarea>
              <span class="field-error">Please add a short message.</span>
            </div>
            <div class="col-2">
              <label class="checkbox">
                <input type="checkbox" name="consent" required>
                <span>I am happy to be contacted about this enquiry, and I have read the <a href="privacy-policy.html" style="color:var(--green)">privacy policy</a>.</span>
              </label>
            </div>
          </div>
          <p id="contact-status" class="tiny muted" hidden style="margin-top:1rem"></p>
          <div class="btn-row" style="margin-top:1.5rem">
            <button class="btn btn-primary btn-lg" type="submit">Send message ${icon('arrow')}</button>
            <a class="btn btn-ghost btn-lg" href="book.html" data-cta="contact">Or book online</a>
          </div>
        </form>
      </div>

      <div style="display:grid;gap:1.25rem">
        <div class="info-list" data-stagger="70">
          <a class="info-item" href="tel:${site.phoneHref}" data-reveal>
            <span class="info-icon">${icon('phone')}</span>
            <span class="info-text"><strong>Phone</strong><span>${esc(site.phone)}</span></span>
          </a>
          <a class="info-item" href="mailto:${site.email}" data-reveal>
            <span class="info-icon">${icon('mail')}</span>
            <span class="info-text"><strong>Email</strong><span>${esc(site.email)}</span></span>
          </a>
          <a class="info-item" href="${site.directionsUrl}" target="_blank" rel="noopener" data-reveal>
            <span class="info-icon">${icon('pin')}</span>
            <span class="info-text"><strong>Clinic</strong><span>${esc(addr.venue)}<br>${esc(
    addr.street
  )}, ${esc(addr.locality)}<br>${esc(addr.region)} ${esc(addr.postcode)}</span></span>
          </a>
        </div>

        <div data-reveal>
          <h3 style="margin-bottom:1rem">Opening hours</h3>
          <div class="hours-table">
            ${site.hours
              .map(
                (h) => `<div class="hours-row${h.closed ? ' is-closed' : ''}" data-day="${h.day}">
              <span>${h.day}</span><span>${h.closed ? 'Closed' : `${h.open} – ${h.close}`}</span>
            </div>`
              )
              .join('')}
          </div>
        </div>

        <div class="map-card" data-reveal>
          <svg class="map-art" viewBox="0 0 600 420" aria-hidden="true">
            <g stroke="rgba(255,255,255,0.10)" stroke-width="1.5" fill="none">
              <path d="M-20 120 H620 M-20 250 H620 M-20 340 H620"/>
              <path d="M110 -20 V440 M270 -20 V440 M430 -20 V440"/>
            </g>
            <g stroke="rgba(0,250,130,0.28)" stroke-width="3" fill="none">
              <path d="M-20 190 H620"/><path d="M350 -20 V440"/>
            </g>
            <g fill="rgba(255,255,255,0.045)">
              <rect x="140" y="60" width="90" height="45" rx="5"/>
              <rect x="300" y="70" width="70" height="60" rx="5"/>
              <rect x="450" y="230" width="100" height="70" rx="5"/>
              <rect x="150" y="280" width="80" height="50" rx="5"/>
            </g>
          </svg>
          <div class="map-pulse" aria-hidden="true"></div>
          <div class="map-pin" aria-hidden="true">${icon('pin')}</div>
          <div class="map-overlay">
            <div><b>${esc(addr.venue)}</b><span>${esc(addr.postcode)}</span></div>
            <a class="btn btn-ghost btn-sm" href="${site.directionsUrl}" target="_blank" rel="noopener">Directions</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="shell">
    <div class="section-head center" data-reveal>
      <span class="eyebrow" style="justify-content:center">Local</span>
      <h2>Treating Newcastle and North Tyneside.</h2>
      <p class="lead">Clients travel in from across the city — the clinic is easy to reach from anywhere north of the river.</p>
    </div>
    <div class="hero-badges" style="justify-content:center" data-reveal>
      ${site.areasServed.map((a) => `<span class="badge">${icon('pin')} ${esc(a)}</span>`).join('')}
    </div>
  </div>
</section>

${ctaBand('Ready when you are.', 'Book online in under a minute, or call the clinic during opening hours.')}
`;

  return {
    slug: 'contact.html',
    title: 'Contact | Sports Injury Clinic Gosforth, Newcastle',
    desc: `Contact J.L. Sports Injury Services at ${addr.venue}, ${addr.street}, ${addr.locality}, Newcastle ${addr.postcode}. Call ${site.phone}, Mon–Thu 9am–8pm, or book online.`,
    body,
    schema: [
      breadcrumbSchema([{ label: 'Home', href: 'index.html' }, { label: 'Contact', href: 'contact.html' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact',
        url: `${site.origin}/contact.html`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Privacy + 404
// ---------------------------------------------------------------------------

function privacy() {
  const body = `
<section class="page-head">
  ${heroBg()}
  <div class="shell">
    ${crumbs([{ label: 'Home', href: 'index.html' }, { label: 'Privacy policy' }])}
    <h1 data-hero>Privacy policy</h1>
    <p class="lead" data-hero style="--d:80ms">How J.L. Sports Injury Services handles your information.</p>
  </div>
</section>

<section class="section" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="shell">
    <div class="prose">
      <p><strong>Last updated:</strong> <span data-year></span></p>

      <h2>Who we are</h2>
      <p>${esc(site.name)}, ${esc(addressOneLine)}. You can reach us on ${esc(site.phone)} or at ${esc(
    site.email
  )}.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Contact details you give us when booking or enquiring — name, email address and phone number.</li>
        <li>Information about your injury and relevant medical history, gathered at your assessment so you can be treated safely.</li>
        <li>Records of your appointments and the treatment provided.</li>
      </ul>

      <h2>Why we hold it</h2>
      <p>Your contact details are used to arrange, confirm and, where necessary, rearrange your appointments. Your clinical notes are held because they are a professional requirement and because they make your ongoing treatment safer and more effective.</p>

      <h2>Who sees it</h2>
      <p>Your information is not sold and is not shared for marketing. It is shared only where you have asked us to (for example with a GP or consultant), or where we are legally required to do so. Online bookings are processed through our booking provider, who handle your details under their own privacy policy.</p>

      <h2>How long we keep it</h2>
      <p>Clinical records are retained for the period required of healthcare professionals in the UK. Enquiry details that do not lead to an appointment are removed once they are no longer needed.</p>

      <h2>Your rights</h2>
      <p>You can ask to see the information we hold about you, ask for it to be corrected, or ask for it to be deleted where we are not required to keep it. Contact us at ${esc(
        site.email
      )} and we will respond within one month.</p>

      <h2>Cookies</h2>
      <p>This website does not use advertising or tracking cookies. Nothing is stored on your device beyond what is needed for the site to function.</p>

      <p class="tiny muted" style="margin-top:2.5rem">
        This policy is a plain-English starting point. Please have it reviewed against your own record-keeping
        and insurance requirements before the site goes live.
      </p>
    </div>
  </div>
</section>
`;

  return {
    slug: 'privacy-policy.html',
    title: 'Privacy Policy | J.L. Sports Injury Services',
    desc: 'How J.L. Sports Injury Services in Gosforth, Newcastle collects, uses, stores and protects your personal details and clinical records.',
    body,
    noindex: false,
    schema: [],
  };
}

function notFound() {
  const body = `
<section class="page-head" style="min-height:70vh;display:grid;align-content:center">
  ${heroBg()}
  <div class="shell" style="text-align:center">
    <span class="eyebrow" style="justify-content:center" data-hero>404</span>
    <h1 data-hero style="--d:80ms">That page has moved on.</h1>
    <p class="lead" data-hero style="--d:160ms;margin-inline:auto">
      The page you were looking for is not here — but everything else is.
    </p>
    <div class="btn-row" style="justify-content:center;margin-top:2rem" data-hero style="--d:240ms">
      <a class="btn btn-primary btn-lg" href="index.html">Back to home</a>
      <a class="btn btn-ghost btn-lg" href="book.html">Book an appointment</a>
    </div>
    <h2 class="eyebrow" style="justify-content:center;margin-top:4rem">Popular treatments</h2>
    <div class="grid grid-3" style="margin-top:1.5rem;text-align:left" data-stagger="80">
      ${treatments
        .slice(0, 3)
        .map(
          (t) => `<a class="card" href="${t.slug}.html" data-reveal>
        <div class="card-icon">${icon(t.icon)}</div>
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.summary)}</p>
      </a>`
        )
        .join('')}
    </div>
  </div>
</section>
`;

  return {
    slug: '404.html',
    title: 'Page Not Found | J.L. Sports Injury Services',
    desc: 'The page you were looking for could not be found. Browse treatments, prices and online booking at J.L. Sports Injury Services in Gosforth, Newcastle.',
    body,
    noindex: true,
    schema: [],
  };
}

module.exports = {
  pages: () => [
    home(),
    about(),
    services(),
    ...treatments.map(treatmentPage),
    book(),
    contact(),
    privacy(),
    notFound(),
  ],
};
