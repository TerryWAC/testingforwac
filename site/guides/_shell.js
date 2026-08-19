/* Shared page shell for the guides.
 *
 *   node guides/_shell.js
 *
 * Each guide is authored as a small object in guides/_content.js — title,
 * description, target segment and body HTML. This wraps them in the site's
 * header, footer, structured data and CTA so there is one place to change
 * the furniture rather than three.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const guides = require('./_content.js');

const SEGMENT_LABEL = {
  'first-time-buyer': 'Talk about buying your first home',
  'remortgage': 'Start a remortgage review',
  'other': 'Tell me about your situation'
};

function page(g, all) {
  const others = all.filter(o => o.slug !== g.slug);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${g.title} — Mortgage Fixer</title>
<meta name="description" content="${g.description}">
<meta name="theme-color" content="#0b1524">
<link rel="canonical" href="https://[YOUR-DOMAIN]/guides/${g.slug}.html">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_GB">
<meta property="og:site_name" content="Mortgage Fixer">
<meta property="og:title" content="${g.title}">
<meta property="og:description" content="${g.description}">
<meta property="og:url" content="https://[YOUR-DOMAIN]/guides/${g.slug}.html">
<meta property="og:image" content="https://[YOUR-DOMAIN]/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%230f7b6c'/><path d='M22 54 50 30l28 24v22a4 4 0 0 1-4 4H60V60H40v20H26a4 4 0 0 1-4-4z' fill='white'/></svg>">
<link rel="stylesheet" href="../assets/styles.css">
<script>try{var t=localStorage.getItem('mf-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": ${JSON.stringify(g.title)},
  "description": ${JSON.stringify(g.description)},
  "author": { "@type": "Person", "name": "Sam" },
  "publisher": { "@type": "Organization", "name": "Mortgage Fixer" },
  "mainEntityOfPage": "https://[YOUR-DOMAIN]/guides/${g.slug}.html",
  "inLanguage": "en-GB"
}
</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>

<header class="site-header" id="site-header">
  <div class="wrap site-header__inner">
    <a class="brand" href="../index.html">
      <svg class="brand__mark" viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" rx="22" fill="currentColor" style="color:var(--accent)"></rect>
        <path d="M22 54 50 30l28 24v22a4 4 0 0 1-4 4H60V60H40v20H26a4 4 0 0 1-4-4z" fill="#fff"></path>
      </svg>
      <span class="brand__name">Mortgage Fixer<span>with Sam</span></span>
    </a>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <ul class="nav__list">
        <li><a href="../index.html#services">What I do</a></li>
        <li><a href="../index.html#calculators">Calculators</a></li>
        <li><a href="index.html">Guides</a></li>
        <li><a href="../index.html#faq">FAQs</a></li>
      </ul>
    </nav>
    <div class="header__actions">
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Switch to dark theme">
        <svg class="icon-moon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="icon-sun" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <a class="btn btn--primary" href="../index.html#contact">Book a free chat</a>
      <button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </div>
</header>

<main id="main" class="section">
  <div class="wrap">
    <article class="article">
      <p class="breadcrumb"><a href="../index.html">Home</a> › <a href="index.html">Guides</a> › ${g.short}</p>
      <h1>${g.title}</h1>
      <p class="lede">${g.description}</p>
      <p class="article__meta"><span>${g.readingTime} minute read</span><span>Written for ${g.audience}</span></p>

${g.body}

      <div class="article__cta">
        <h2>${g.ctaHeading}</h2>
        <p>${g.ctaBody}</p>
        <a class="btn btn--on-dark btn--lg" href="../index.html?segment=${g.segment}#contact">${SEGMENT_LABEL[g.segment]}</a>
      </div>

      <p class="disclaimer">
        This guide is general information about how UK mortgages work, not advice about your
        own circumstances, and it isn't an offer of credit. Rules, rates and lender criteria
        change — check anything time-sensitive before acting on it. Your home may be repossessed
        if you do not keep up repayments on your mortgage.
      </p>

      <h2>More guides</h2>
      <div class="grid grid--2">
${others.map(o => `        <a class="card card--interactive guide-card" href="${o.slug}.html">
          <h3>${o.short}</h3>
          <p>${o.description}</p>
          <span class="card__link">Read the guide
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </a>`).join('\n')}
      </div>
    </article>
  </div>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="legal">
      <p class="risk-warning">Your home may be repossessed if you do not keep up repayments on your mortgage.</p>
      <p class="placeholder">
        [FIRM LEGAL NAME] is an appointed representative of [NETWORK NAME], which is authorised
        and regulated by the Financial Conduct Authority. FCA reference [FRN].
      </p>
      <p>
        The Financial Conduct Authority does not regulate most buy-to-let mortgages.
        The guidance on this site is aimed at UK residents only.
      </p>
      <p>&copy; <span id="year">2026</span> <span class="placeholder">[FIRM LEGAL NAME]</span>.
        · <a href="../index.html">Home</a> · <a href="index.html">Guides</a>
        · <a href="../privacy.html">Privacy notice</a></p>
    </div>
  </div>
</footer>
<script src="../assets/app.js" defer></script>
</body>
</html>
`;
}

function indexPage(all) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mortgage guides — Mortgage Fixer</title>
<meta name="description" content="Plain-English guides to UK mortgages: how much deposit you really need, when to start a remortgage, and how lenders treat self-employed income.">
<meta name="theme-color" content="#0b1524">
<link rel="canonical" href="https://[YOUR-DOMAIN]/guides/">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%230f7b6c'/><path d='M22 54 50 30l28 24v22a4 4 0 0 1-4 4H60V60H40v20H26a4 4 0 0 1-4-4z' fill='white'/></svg>">
<link rel="stylesheet" href="../assets/styles.css">
<script>try{var t=localStorage.getItem('mf-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header" id="site-header">
  <div class="wrap site-header__inner">
    <a class="brand" href="../index.html">
      <svg class="brand__mark" viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" rx="22" fill="currentColor" style="color:var(--accent)"></rect>
        <path d="M22 54 50 30l28 24v22a4 4 0 0 1-4 4H60V60H40v20H26a4 4 0 0 1-4-4z" fill="#fff"></path>
      </svg>
      <span class="brand__name">Mortgage Fixer<span>with Sam</span></span>
    </a>
    <nav class="nav" id="primary-nav" aria-label="Primary">
      <ul class="nav__list">
        <li><a href="../index.html#services">What I do</a></li>
        <li><a href="../index.html#calculators">Calculators</a></li>
        <li><a href="index.html" aria-current="true">Guides</a></li>
        <li><a href="../index.html#faq">FAQs</a></li>
      </ul>
    </nav>
    <div class="header__actions">
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Switch to dark theme">
        <svg class="icon-moon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="icon-sun" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <a class="btn btn--primary" href="../index.html#contact">Book a free chat</a>
      <button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </div>
</header>

<main id="main" class="section">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Guides</span>
      <h1>The things people ask me most, written down</h1>
      <p class="lede">
        Plain English, no jargon, and no attempt to sell you anything. If a guide answers your
        question completely and you never need to call me, that's a good outcome.
      </p>
    </div>
    <div class="grid grid--2">
${all.map(g => `      <a class="card card--interactive guide-card" href="${g.slug}.html">
        <h3>${g.short}</h3>
        <p>${g.description}</p>
        <span class="card__link">Read the guide · ${g.readingTime} min
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
      </a>`).join('\n')}
    </div>
  </div>
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="legal">
      <p class="risk-warning">Your home may be repossessed if you do not keep up repayments on your mortgage.</p>
      <p class="placeholder">
        [FIRM LEGAL NAME] is an appointed representative of [NETWORK NAME], which is authorised
        and regulated by the Financial Conduct Authority. FCA reference [FRN].
      </p>
      <p>&copy; <span id="year">2026</span> <span class="placeholder">[FIRM LEGAL NAME]</span>.
        · <a href="../index.html">Home</a> · <a href="../privacy.html">Privacy notice</a></p>
    </div>
  </div>
</footer>
<script src="../assets/app.js" defer></script>
</body>
</html>
`;
}

const dir = __dirname;
guides.forEach(g => fs.writeFileSync(path.join(dir, g.slug + '.html'), page(g, guides)));
fs.writeFileSync(path.join(dir, 'index.html'), indexPage(guides));
console.log('Built ' + guides.length + ' guides + index.');
