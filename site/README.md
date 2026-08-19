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
├── assets/
│   ├── styles.css          design tokens, light + dark, print
│   ├── rates.js            ← Stamp Duty bands. The file to edit after a Budget.
│   ├── app.js              calculators, form validation, nav
│   └── og-image.jpg        social share card (1200×630)
└── test/
    └── run.js              browser test suite
```

## Tests

79 checks covering the calculators, the multi-step form, segment tailoring and
routing, lead-context capture, the reminder form, keyboard navigation, the no-JS
fallback, layout at seven widths, and the other two pages.

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

## ⚠️ Before this goes live

This was built without access to Sam's existing page — the network policy in the build
environment blocks `*.chatgpt.site`. **Every business-specific fact is a `[BRACKETED]`
placeholder.** They are underlined in amber on the rendered page so they are impossible
to miss.

### The quick way: `config.json`

Fill in the values, run the script, done — no hunting through markup:

```bash
cd site
$EDITOR config.json
./fill-placeholders.sh
```

It snapshots pristine copies into `.templates/` on first run and always
substitutes from those, so it is safe to re-run as many times as you like.
It reports which values are still blank and which placeholders remain.

`YOUR-DOMAIN` takes the full domain including the TLD — `mortgagefixer.co.uk`,
not `mortgagefixer` and not `https://mortgagefixer.co.uk/`.

Some things are prose rather than simple tokens — the compliance wording, fee
disclosure, reviews and stats. Edit those by hand. To find everything left:

```bash
grep -rn "\[[A-Z][A-Z0-9 …/&-]*\]" site/
```

### Must be filled in — legal and regulatory

| Placeholder | Where | Notes |
|---|---|---|
| `[FIRM LEGAL NAME]` | footer, privacy | The registered name, not the trading name |
| `[NETWORK NAME]`, `[FRN]` | footer, privacy | Exact wording should come from your network's compliance team |
| `[FEE WORDING]` | footer, FAQ | FCA requires fees disclosed clearly and up front |
| `[Registered in England… number]` | footer | Companies Act s.82 requires this on a business website |
| ICO registration | privacy | Brokers generally must register as a data controller |
| Retention periods | privacy | Typically 6+ years for mortgage advice — confirm |

The **"Your home may be repossessed…"** risk warning is already in place on both pages and
should stay there.

### Must be filled in — business details

`[SURNAME]` · `[PHONE NUMBER]` and `[PHONE-E164]` (the `tel:` links, e.g. `tel:+447700900123`) ·
`[EMAIL ADDRESS]` · `[TOWN]` / `[REGION]` / `[POSTCODE]` / `[STREET]` · `[YOUR-DOMAIN]` ·
opening hours · `[90+]` lenders.

`[YOUR-DOMAIN]` appears in the canonical tag, Open Graph tags, JSON-LD, `robots.txt` and
`sitemap.xml` — replace it everywhere or search engines will index the wrong URLs.

### Must be replaced — the stats and reviews

The trust-bar numbers and all three testimonials are placeholders. Under the FCA's Consumer
Duty and CAP advertising rules, testimonials must be **genuine, verifiable and held on file**.
Delete the section entirely rather than publish invented ones.

The animated counter reads `data-count-to` — set it to a plain number (`data-count-to="450"`)
once you have a real figure.

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
