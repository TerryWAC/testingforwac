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
└── assets/
    ├── styles.css          design tokens, light + dark
    ├── rates.js            ← Stamp Duty bands. The file to edit after a Budget.
    └── app.js              calculators, form validation, nav
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

## Connecting the enquiry form

The form validates fully client-side but has no `action`, so it currently tells the visitor it
isn't connected. Pick one:

**Formspree / Basin / Netlify Forms** — quickest. Add the endpoint:

```html
<form id="enquiry-form" method="post" action="https://formspree.io/f/YOUR_ID">
```

(For Netlify, add `data-netlify="true"` instead of an action.)

**Your own handler** — point `action` at it. The form posts `name`, `phone`, `email`, `stage`,
`message`, `consent`, plus a honeypot field called `website` — if `website` is non-empty, it's a
bot; discard it silently.

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
- **Performance** — no fonts, frameworks or third-party requests. Two small local assets.

## Suggested next steps

1. Fill the placeholders and get the compliance wording signed off.
2. Buy a proper domain. A `.chatgpt.site` subdomain isn't yours, can't move, and reads as
   temporary to anyone comparing brokers.
3. Add a real photo of Sam to the hero — for a personal-brand broker it measurably outperforms
   an illustration.
4. Set up Google Business Profile and link the reviews here.
5. Consider a short article per FAQ topic; those are the searches people actually type.
