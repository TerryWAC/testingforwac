# Mortgage Fixer — website

A fast, accessible, self-hosted replacement for the `mortgage-fixer-sam.terry-blackburn.chatgpt.site`
page. No frameworks, no build step, no external requests — three files and it deploys anywhere.

```
site/
├── index.html              the page
├── privacy.html            UK GDPR privacy notice
├── 404.html
├── robots.txt
├── sitemap.xml
├── config.json             ← your details go here
├── fill-placeholders.sh    ← then run this
├── guides/
│   ├── _content.js         ← guide text lives here
│   ├── _shell.js           `node guides/_shell.js` rebuilds the pages
│   └── *.html              generated — do not hand-edit
├── assets/
│   ├── styles.css          design tokens, light + dark, print
│   ├── rates.js            ← Stamp Duty bands. The file to edit after a Budget.
│   ├── app.js              calculators, form validation, nav
│   └── og-image.jpg        social share card (1200×630)
└── test/
    └── run.js              browser test suite
```

## Guides

Three long-form guides, each aimed at one of the form's lead segments and ending
with a CTA that deep-links back with `?segment=...` so the reader arrives at the
enquiry form with their situation already selected.

Edit the text in `guides/_content.js`, then rebuild:

```bash
node guides/_shell.js
```

The generated `.html` files are overwritten on every build — put changes in
`_content.js`, not in the output. The shell holds the header, footer, structured
data and CTA so the furniture lives in one place.

To add a guide: append an object to `_content.js`, rebuild, then add it to
`sitemap.xml`, the `FILES` list in `fill-placeholders.sh`, and the `guides`
array in `test/run.js`.

Content is general information about how UK mortgages work, not advice, and each
page says so. Keep anything rate- or threshold-specific phrased so it stays true.

## WordPress / Elementor

```bash
node build-elementor.js
```

Writes paste-ready blocks to `dist/`. Drop any one into an Elementor **HTML**
widget — no `<html>`/`<head>`/`<body>`, all CSS and JS inline, nothing loaded
from this repo.

| File | What it contains |
|---|---|
| `elementor-calculators.html` | All three calculators |
| `elementor-enquiry-form.html` | The 3-step qualifying form |
| `elementor-rate-reminder.html` | The rate-expiry capture |
| `elementor-everything.html` | All of the above |

Build the static parts (hero, service cards, FAQ) with Elementor's own widgets —
these blocks are for the interactive pieces Elementor can't do natively.

**How it survives a theme.** Every CSS selector is prefixed with `.mfw`, and
`:root` / `html` / `body` are rewritten to `.mfw`, so the design tokens live on
the wrapper and nothing escapes into the page. The JS runs in a closure where
`document` is shadowed by a shim rooted at the widget, so an element with the
same id elsewhere on the page is invisible to it. A defensive reset re-asserts
font, heading colour, borders and link colour with `!important`, because themes
routinely force those.

This is tested, not assumed: the suite builds the widgets, checks every selector
is scoped, then loads one inside a deliberately hostile theme (Georgia serif,
`content-box`, `all: unset` on buttons, `!important` on fonts and links, and a
colliding `#mf-price`) and verifies the calculator still computes, the theme's
own element is untouched, and neither side bleeds into the other.

**Fonts.** The blocks load Poppins from Google Fonts. If your site already loads
Poppins, delete the three `<link>` tags at the top. To avoid the third-party
request, upload the woff2 files from `assets/fonts/` to your media library and
swap in an `@font-face` pointing at them.

`dist/` is build output and is gitignored — regenerate it rather than editing it,
and don't deploy those files as pages of the site.

## Tests

161 checks covering the calculators, the multi-step form, segment tailoring and
routing, lead-context capture, the reminder form, keyboard navigation, the no-JS
fallback, layout at seven widths, the guides, a
whole-site link crawl (broken links, orphan pages, stray templates), per-page
navigation and risk-warning checks, sitemap coverage, and every page at 320px
including touch-target sizing, a rendered
contrast sweep of every page in both themes, and the Elementor widgets inside a
hostile theme.

### Typography

Poppins, self-hosted from `assets/fonts/` — latin subset, five weights, 38 KB
total. Self-hosted rather than loaded from Google Fonts so no visitor IP reaches
a third party, which matters for a site that publishes a privacy notice, and so
the font is not a render-blocking cross-origin round trip.

### Colour

Everything comes from tokens in `assets/styles.css` — the markup contains no hex
or `rgb()` literals, and a test enforces that. Contrast is measured on rendered
pixels rather than assumed: the sweep walks every text element on every page in
both themes, resolves the real background (including gradient stops, taking the
worst one), and fails below WCAG AA. `--accent-on-dark` exists because
`--accent-400` clears AA against the dark end of the hero gradient but only
reaches 4:1 against the light end.

```bash
cd site/test && npm install && npm test
```

Financial figures are asserted against values computed independently inside the
test file, so a bug in the page cannot make its own output look correct. Every
bug found so far has a test pinning it — run this before deploying.

If Chromium isn't where Playwright expects it:

```bash
CHROME=/path/to/chrome node test/run.js
```

## Run it

Any static server. There is nothing to build:

```bash
cd site && python3 -m http.server 8080   # then open http://localhost:8080
```

Deploy by dragging the `site/` folder onto Netlify, Cloudflare Pages, GitHub Pages or
any normal web host.

---

## Before this goes live

**Four regulatory details block publication** — registered firm name, network,
FRN and company number. `./fill-placeholders.sh` will keep telling you which are
outstanding. See **[HANDOVER.md](HANDOVER.md)** for the full list to ask Sam for.

Everything else is optional. Anything left blank in `config.json` is **removed
from the page** rather than shown as a placeholder, so the site reads as finished
while details are still outstanding:

```bash
cd site
$EDITOR config.json
./fill-placeholders.sh
```

It snapshots pristine copies into `.templates/` on first run and always
substitutes from those, so it is safe to re-run as many times as you like.

`YOUR-DOMAIN` takes the full host — `mortgagefixer.co.uk`, not `mortgagefixer`
and not `https://mortgagefixer.co.uk/`. It is currently set to the live
`chatgpt.site` address so the site works at its present home today.

### Marking something optional

Put `data-needs="KEY"` on any element. If `KEY` is blank in `config.json`, the
whole element — including anything nested inside it — is removed at build time.
That is how the phone row, the sticky Call button and the registered-office
sentence disappear when those details are unknown.

### No invented content

The site ships with no fabricated statistics and no placeholder reviews. The
trust bar states only what is true by construction, and the testimonial section
was replaced with content that stands on its own. When real reviews exist, paste
the block from `REVIEWS-TEMPLATE.txt`.

---

## The lead system

The page is built to collect enquiries from the specific groups it targets,
rather than offering one generic "contact us" box.

**Three ways in, aimed at different levels of readiness:**

| Route | Who it catches | Friction |
|---|---|---|
| 3-step enquiry form | People ready to talk | Contact details asked last |
| Rate-expiry reminder | People whose deal ends later — the biggest group, and the one most brokers lose | Email + month |
| Calculator handoff | People who came to run numbers, not to enquire | None — figures carry over |

**The form asks in the right order.** Step 1 is the cheapest possible question:
what are you trying to do, and when. No name, no phone, nothing personal until
step 3, once the visitor has already invested a little effort. The progress bar
sets the expectation ("about 40 seconds").

**It adapts to who answered.** Choosing *Remortgage* changes the step-2 heading,
relabels the deposit field to "Roughly what do you owe?", and reveals a question
about when the current deal ends. A first-time buyer never sees that question.
Edit the `SEGMENTS` map in `assets/app.js` to change the wording.

**Every service card routes into it.** Clicking "Remortgaging" jumps to the form
with that segment already chosen — the visitor never answers the same question twice.

**Each enquiry carries context you did not have to ask for:** which calculator
they used and the figures they entered, the campaign tags on the link that
brought them (`utm_source`, `utm_medium`, `utm_campaign`), the referring site,
and the landing page. First touch wins, so an internal click later does not
overwrite the advert that actually worked.

**Qualifying fields chosen for what actually changes a case:** how they are paid
(self-employed and contractors need different lenders), credit history, timeline,
and best time to call. That is the difference between an enquiry and a lead you
can act on.

### Measuring it

Events are pushed to `window.dataLayer` and are inert unless you add an analytics
tool: `mf_form_step`, `mf_segment_selected`, `mf_segment_route`, `mf_lead_submit`,
`mf_reminder_signup`. The step events show exactly where people drop out.

Adding an analytics tool that sets cookies means you will need a consent banner
under PECR, and the privacy notice will need updating. Nothing here sets a cookie
today.

## Connecting the enquiry form

The form validates fully client-side but has no `action`, so it currently tells the visitor it
isn't connected. Pick one:

**Formspree / Basin / Netlify Forms** — quickest. Add the endpoint:

```html
<form id="enquiry-form" method="post" action="https://formspree.io/f/YOUR_ID">
```

(For Netlify, add `data-netlify="true"` instead of an action.)

**Your own handler** — point `action` at it. The enquiry posts `name`, `phone`, `email`,
`stage`, `timeline`, `employment`, `income`, `deposit`, `rate_end`, `credit`, `best_time`,
`message`, `consent`, plus `calculator_used`, `calculator_figures`, `utm_source`,
`utm_medium`, `utm_campaign`, `referrer` and `landing_page`. There is also a honeypot
field called `website` — if it is non-empty, it's a bot; discard silently.

**There are two forms.** The rate-expiry reminder (`#reminder-form`) needs its own
`action`, and posts `email`, `rate_end` and `lead_type=rate-expiry-reminder`. Point it
at the same handler or a separate list — a reminder signup is a different kind of lead
from an enquiry, and worth keeping apart.

Whichever you choose, remember the enquiry contains personal data: use HTTPS, don't log it
anywhere public, and make sure the destination inbox is covered by the retention policy in your
privacy notice.

---

## Stamp Duty rates

`assets/rates.js` holds the SDLT bands as a plain, commented table with an
`EFFECTIVE_FROM` date that the page displays to visitors. **Re-check it after every
Budget** — the rates in there reflect the thresholds that took effect 1 April 2025,
and gov.uk is the source of truth.

The calculator covers **England and Northern Ireland only**. Scotland (LBTT) and
Wales (LTT) have different bands entirely; the page says so rather than quietly
giving a wrong number.

## What's in here beyond the original

- **Three working calculators** — monthly repayment (repayment/interest-only, overpayment
  saving projection, capital-vs-interest bar), affordability, and Stamp Duty with a
  band-by-band breakdown showing how the total is reached. Standard amortisation
  including the 0% edge case; progressive SDLT banding with first-time buyer relief
  (including the cliff-edge above £500,000) and the additional-property surcharge.
  Every output was checked against independently computed values.
- **SEO** — title, meta description, canonical, Open Graph, and `FinancialService` JSON-LD
  structured data, so the business can appear as a rich result.
- **Accessibility** — skip link, real focus rings, ARIA tab pattern with arrow-key support,
  `aria-live` result regions, labelled inputs, inline error messages, and `prefers-reduced-motion`
  respected.
- **Dark mode** — follows the system setting, with a manual toggle that persists.
- **Mobile** — sticky call/book bar under 720px, collapsing nav, fluid type throughout.
- **Performance** — no fonts, frameworks or third-party requests.
- **Enquiry handoff** — the button inside each result panel carries the figures the
  visitor just worked out into the message box and picks a matching subject, so
  they never retype them. It replaces its own previous summary rather than
  stacking duplicates, and never overwrites something the visitor typed.
- **Print stylesheet** — strips nav, buttons and backgrounds, inverts the dark result
  panels for paper, expands every calculator tab and FAQ answer, and appends URLs
  after links.
- **Social share card** — `assets/og-image.jpg`, 1200×630. Regenerate it after
  changing the branding; it is a screenshot of an HTML template at that viewport.

## Suggested next steps

1. Fill the placeholders and get the compliance wording signed off.
2. Buy a proper domain. A `.chatgpt.site` subdomain isn't yours, can't move, and reads as
   temporary to anyone comparing brokers.
3. Add a real photo of Sam to the hero — for a personal-brand broker it measurably outperforms
   an illustration.
4. Set up Google Business Profile and link the reviews here.
5. Consider a short article per FAQ topic; those are the searches people actually type.
