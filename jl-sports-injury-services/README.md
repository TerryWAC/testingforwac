# J.L. Sports Injury Services — website

A rebuild of [jlsportsinjuryservices.com](https://www.jlsportsinjuryservices.com) as a fast,
SEO-optimised static site built around one job: turning visitors into booked appointments.

Static HTML, CSS and vanilla JS. No framework, no build tooling to install, no runtime
dependencies. It deploys to any host — Netlify, Vercel, Cloudflare Pages, GitHub Pages, or
straight onto existing hosting via FTP.

---

## Quick start

```bash
npm run build      # regenerate site/ from src/
npm run serve      # preview at http://localhost:8899
npm run verify     # build, then run the full browser test suite
npm run demo       # build + check demo.html, the shareable single-file version
```

To publish, upload the contents of `site/`. That folder is the whole website.

### Sending it to the client

`npm run demo` packs every page, the CSS, the fonts and the booking flow into a
single `demo.html` with hash routing — one file, no server, no install. Open it
locally or host it anywhere to show the site off. The only thing it drops is the
"add to calendar" download, which needs a real web host to work.

`site/` is still the real website. The demo is a delivery convenience, not the
deliverable — it has no per-page URLs, so don't deploy it as the live site.

For a live URL in about thirty seconds: drag the `site/` folder onto
[app.netlify.com/drop](https://app.netlify.com/drop).

---

## Pages

Every page from the original site is here, plus a dedicated booking page.

| Page | File | Original |
|---|---|---|
| Home | `index.html` | `/` |
| About Us | `about-us.html` | `/about-us` |
| Treatments | `services.html` | `/services` |
| Injury Assessment | `injury-assessment.html` | `/injury-assessment` |
| Sports Massage | `sports-massage.html` | `/sports-massage3` |
| Deep Tissue Massage | `deep-tissue-massage.html` | `/deep-tissue-massage` |
| Injury Treatment | `follow-up-treatment.html` | `/follow-up-treatment` |
| Medical Acupuncture | `medical-acupuncture.html` | `/medical-acupuncture` |
| Electrotherapy | `electrotherapy.html` | `/electrotherapy` |
| Ultrasound Therapy | `ultrasound-therapy.html` | `/ultrasound-therapy` |
| Contact | `contact.html` | — |
| Book online | `book.html` | new |
| Privacy policy | `privacy-policy.html` | new |
| 404 | `404.html` | new |

**Redirects.** The old sports massage URL was `/sports-massage3`. Point it at
`/sports-massage` with a 301 when you switch over so the existing ranking carries across.
Same for any other old URL that changes.

---

## The booking flow

`book.html` is a five-step wizard: treatment → length → date → time → details.

- Only real opening days are offered (Mon–Thu), and only slots that fit the chosen
  appointment length inside 9am–8pm. Same-day slots inside the next two hours are disabled.
- The form validates before it will submit.
- On confirmation the visitor gets four ways to finish, all pre-filled with their choices:
  **confirm in the Fresha diary**, **send by email**, **text the clinic**, or
  **add to calendar** (`.ics` download).
- Deep links work: `book.html?treatment=sports-massage` opens with that treatment selected.
  Every price and treatment link on the site uses these, so a visitor arrives one step in.

**This does not write into the Fresha diary directly** — Fresha has no public booking API.
The wizard qualifies the enquiry and hands it over complete, rather than dropping a cold
visitor onto a third-party page. If you would rather the site book straight into the diary,
the alternative is to embed Fresha's own booking widget on `book.html`; say the word and
it can be swapped in.

---

## Things to confirm before it goes live

1. **Prices** — `src/content.js`. The 30-minute (£30) and 60-minute (£44) sports massage
   rates come from your published full prices. The 45-minute and follow-up rates are
   sensible mid-points and need your confirmation. Every price on the site, in the booking
   flow and in the search-engine markup comes from this one file.
2. **Email address** — currently `info@jlsportsinjuryservices.com`. Change it in
   `src/content.js` if enquiries should go elsewhere.
3. **Instagram link** — a best guess at the handle. Correct or remove it in `src/content.js`.
4. **Photography** — see below.
5. **Privacy policy** — a plain-English starting point. Worth checking against your
   record-keeping and insurance requirements.

---

## Photography

The build could not reach the images on the live site (they sit behind a host this build
environment cannot fetch), so every photo position currently shows a branded placeholder
rather than a broken image. They look deliberate, but they are placeholders.

**Adding the real photos takes one step.** Save each file into `site/assets/img/` using the
slot name below — `.webp`, `.jpg`, `.png` and `.avif` all work — then run `npm run build`.
The build finds the file, swaps it in over the placeholder and fades it in. There is no
markup to edit, and while a slot is still empty nothing is requested, so there are no
broken images and no failed requests.

| Slot | Where it appears | Suggested shot |
|---|---|---|
| `jack-portrait` | Home, "Meet your therapist" | Jack, portrait, 4:5 |
| `jack-treating` | About | Treatment in progress |
| `clinic-gym` | About | The gym floor at Hidden Strength, 16:10 |
| `treatment-<slug>` | Each treatment page | That treatment being delivered, 16:10 |

Good photography is the single biggest visual upgrade left on this site.

---

## SEO

- Unique title and meta description per page, all within Google's display limits.
- Canonical URLs, Open Graph and Twitter card tags, generated share image.
- Structured data: `MedicalBusiness` with address, geo, opening hours, service area and a
  `ReserveAction`; plus `Service`, `BreadcrumbList`, `FAQPage` and `Person` markup.
- `sitemap.xml`, `robots.txt` and a web app manifest generated at build time.
- Local targeting throughout — Gosforth, Newcastle upon Tyne and surrounding areas.
- Semantic headings, one `<h1>` per page, descriptive link text, skip link, ARIA on the
  interactive components, and full `prefers-reduced-motion` support.
- Self-hosted fonts (105 kB total), no third-party scripts, no tracking, no cookie banner
  needed. Nothing blocks the first render.

**One deliberate omission:** the 5.0 star rating is shown prominently on the page and links
out to the platforms it lives on, but it is *not* included as `aggregateRating` in the
structured data. Google treats self-serving review markup on your own site as a policy
violation, and it can cost you a rich result. Displaying it and linking out is the safe way
to get the same trust benefit.

### Before launch

- Set `origin` in `src/content.js` to the live domain — it drives canonicals, Open Graph
  URLs and the sitemap.
- Submit `sitemap.xml` in Google Search Console.
- Make sure the Google Business Profile name, address, phone and hours match this site
  exactly. Consistent details are the biggest single factor in local map rankings.

---

## How it is built

```
src/content.js     all copy, prices, hours, contact details  ← edit this
src/pages.js       page templates
src/layout.js      <head>, header, footer, structured data
src/icons.js       inline SVG icon set
src/build.js       writes site/, sitemap, robots, manifest
src/verify.js      browser test suite
src/make-images.js generates the share image and app icon
site/              the built website — this is what you deploy
```

`src/content.js` is the single source of truth. Change a price, a phone number or an
opening time there and it updates across every page, the booking flow and the search
markup in one go.

## Tests

`npm run verify` drives a real browser and checks:

- every page loads with no console or network errors
- exactly one `<h1>`, and title/description lengths within limits, per page
- no horizontal overflow at 1440px or 390px
- the mobile menu and FAQ accordion open
- the booking flow end to end: only Mon–Thu offered, correct slot count and range for the
  chosen duration, empty-form validation blocks submission, the confirmation summary shows
  the right treatment/price/date, and the email, Fresha and calendar handoffs are all built
  correctly
- every internal link resolves to a file that exists
