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

| Page | File | On his current site |
|---|---|---|
| Home | `index.html` | `/` |
| About Us | `about-us.html` | `/about-us` |
| Services | `services.html` | `/services` |
| Initial Assessment | `injury-assessment.html` | `/injury-assessment` |
| Sports Massage | `sports-massage.html` | `/sports-massage3` |
| Full Body Massage | `deep-tissue-massage.html` | `/deep-tissue-massage` |
| Injury Treatment | `follow-up-treatment.html` | `/follow-up-treatment` |
| Medical Acupuncture | `medical-acupuncture.html` | `/medical-acupuncture` |
| Electrotherapy | `electrotherapy.html` | `/electrotherapy` |
| Ultrasound Therapy | `ultrasound-therapy.html` | `/ultrasound-therapy` |
| Price list | `price-list.html` | `/price-list` |
| Reviews | `reviews.html` | `/reviews` |
| Offers | `offers.html` | `/offers` |
| Conditions we treat | `conditions.html` | new |
| Knee pain | `knee-pain.html` | new |
| Back pain | `back-pain.html` | new |
| Neck pain | `neck-pain.html` | new |
| Sciatica & nerve pain | `sciatica-nerve-pain.html` | new |
| Muscle strains | `muscle-strains.html` | new |
| Shoulder pain | `shoulder-pain.html` | new |
| Wrist & elbow pain | `wrist-elbow-pain.html` | new |
| Gift vouchers | `gift-vouchers.html` | button only |
| Your first visit | `first-visit.html` | new |
| FAQs | `faqs.html` | new |
| Contact | `contact.html` | new |
| Book online | `book.html` | new |
| Privacy policy | `privacy-policy.html` | new |
| 404 | `404.html` | new |

### Why the condition pages exist

They are the biggest ranking opportunity the current site is missing. Nobody
searches "sports injury clinic" when their knee hurts — they search "knee pain
Newcastle" or "sciatica Gosforth". Each condition page targets one of those
phrases and answers it properly: how it presents, what causes it, how it is
assessed, how it is treated, how long it takes, and when to see a doctor
instead.

That last part matters. These pages carry red-flag warnings and a note that
they are general information rather than a diagnosis. A health site that only
sells and never says "this one is not for us" is one to be wary of, and Google
judges medical content on exactly that.

They are written to be genuinely useful, not stuffed with a keyword. Thin pages
spun out of a list get ignored by readers and penalised in search. Copy lives in
`src/conditions.js` — worth Jack reading through, since it speaks for him.

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

1. **Prices** — taken from your published price list and set in `src/content.js`: initial
   assessment £55, follow-up £55/£35, sports massage £50/£30, full body massage £80. Worth
   a final read in case anything has moved. Every price on the site, in the booking flow
   and in the search-engine markup comes from that one file.
2. **Review count** — shows 27, matching the Google badge on your current site. If you would
   rather not update it each time a review lands, set `reviews.countLabel` to something like
   `'over 25'` and it will use that wording everywhere instead.
3. **Email address** — currently `info@jlsportsinjuryservices.com`. Change it in
   `src/content.js` if enquiries should go elsewhere.
4. **Instagram link** — a best guess at the handle. Correct or remove it in `src/content.js`.
5. **The offer** — 10% off with code `JLNEW0029` runs in the promo bar and on the offers
   page. Set `offer.active` to `false` in `src/content.js` to take it down everywhere.
6. **Block bookings and vouchers** — described in general terms because the exact block
   rates were not published. Add them to `extras` in `src/content.js` when you have them.
7. **Photography** — see below.
8. **Privacy policy** — a plain-English starting point. Worth checking against your
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

### Getting the photos in

The build environment cannot reach the images on the live site, and screenshots
pasted into a chat cannot be saved to disk either. The one route that works:
**commit the image files into `site/assets/img/` on GitHub** (drag and drop in
the web UI is fine), then `npm run build`. Originals beat screenshots — a
screenshot of the site is already compressed, and the carousel ones are already
cropped to circles and slightly motion-blurred.

| Slot | Where it appears | The photo on his current site |
|---|---|---|
| `clinic-room` | Photo rail | Treatment room, couch and muscle charts |
| `jack-treating` | About, photo rail | Jack treating a client's forearm |
| `jack-portrait` | Home, photo rail | Jack's headshot |
| `waiting-area` | Photo rail | Sofa and table by the window |
| `gym-floor` | Photo rail | Dumbbell racks and green turf |
| `consultation` | Photo rail | Jack talking a client through it |
| `clinic-gym` | About | Gym floor, 16:10 |
| `first-visit` | Your first visit | Treatment room, portrait |
| `gift-voucher` | Gift vouchers | The gift certificate |
| `offers-clinic` | Offers | Anything that reads as "the clinic", 16:10 |
| `treatment-medical-acupuncture` | Acupuncture page | The needles close-up |
| `treatment-<slug>` | Each treatment page | That treatment being delivered, 16:10 |
| `condition-<slug>` | Each condition page | Optional — the contour artwork holds up fine |

`.webp`, `.jpg`, `.png` and `.avif` all work. The photo rail crops to circles,
so centre the subject on anything going there. Nothing is requested for a slot
that is still empty, so partial delivery is fine — add what exists and the rest
keep their artwork.

Good photography is the single biggest visual upgrade left on this site.

---

## Two design directions

The site ships with two complete visual treatments, switchable from the picker
at the bottom of the demo so Jack can see the same pages both ways rather than
compare two static mockups.

**Clinical Dark** — the default. Charcoal-green ground, the brand green as a
signal colour, glass panels and a lit feel. Reads as elite sport and stands
apart from every other massage clinic in Newcastle.

**Clinic Light** — white and near-white, the same green used sparingly. Closer
in feel to his current site and to how most healthcare sites present, which
some clients simply prefer. Not an inversion: the greens, tints, scrims and
shadows are all defined separately for it.

The whole thing is driven by tokens on `:root` and `[data-theme="light"]`, so
picking one is a one-line change — set `data-theme="light"` on `<html>` in
`src/layout.js`, or delete the light block to ship dark only. Both are audited
independently:

```bash
npm run audit              # dark
THEME=light npm run audit  # light
npm run check              # verify + both audits
```

One detail worth knowing: the bright brand green is used as a *fill* in both
themes, because that is the logo colour and it carries 13:1 against the dark
text on it. As *text* it only manages 1.4:1 on white, so `--green-ink` darkens
to #00753f in the light theme. Same brand, readable either way.

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

## Google

Everything Google-related is configured in one place: the `google` block in
`src/content.js`.

### Already working

- **Map.** The contact page and the home page carry a real Google map. By default it loads
  only when the visitor presses "Show map", so no Google cookies are set on someone who
  never asked for one, and none of that payload is in the initial page load. Set
  `google.mapMode` to `'auto'` if you would rather it load with the page like most sites
  do — the trade-off is Google cookies on every visit. "Directions" opens Google Maps with
  the clinic set as the destination.
- **Business Profile and reviews.** Linked from the footer, the reviews panel and the
  structured data's `sameAs`, which is how Google ties the site to the listing.
- **Structured data.** `MedicalBusiness` with the address, coordinates, opening hours,
  service area and a `ReserveAction`, so the clinic is legible to Google as a local
  business rather than just a web page.

### To connect Jack's own account

1. **Business Profile link.** Open the profile → *Read reviews* → *Share*, and paste the
   short link into `google.profileUrl` and `google.reviewsUrl`. The current search URLs
   resolve to the listing, but the profile's own links are cleaner and never drift.
2. **Search Console.** Verify by DNS if possible. If verifying by HTML tag instead, paste
   the code into `google.searchConsoleVerification` and rebuild — it appears on every page.
   Then submit `sitemap.xml`.
3. **Analytics.** Paste the GA4 measurement ID (`G-XXXXXXXXXX`) into `google.analyticsId`
   and rebuild.

### About the analytics switch

Leave `analyticsId` blank and the site loads no third-party script, sets no cookies and
shows no cookie banner. Fill it in and a consent banner appears; Google is only contacted
after the visitor accepts, and the choice is remembered. Declining means nothing from
Google is ever requested.

That is deliberate: GA4 sets cookies, so under UK GDPR/PECR it needs consent first. Firing
it on page load — which most sites do — is not compliant.

One thing to eyeball once it is live: the embedded map could not be loaded from the
environment this was built in, because Google is blocked there. The embed URL is the
standard keyless form and the button and iframe wiring are tested, but give the map one
click on the real site to confirm it renders.

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

`npm run check` runs both suites. `npm run audit` is the accessibility, responsive and
page-weight pass; it checks every page for:

- colour contrast on every text element against its true composited background,
  at WCAG AA (4.5:1 body, 3:1 large text)
- images without alt text, form controls without labels, links and buttons without an
  accessible name, vague link text
- heading order with no skipped levels, landmark elements, a `lang` attribute, zoom not
  disabled, no duplicate ids
- tap targets at least 32px on mobile
- horizontal overflow at 360, 390, 768, 1024, 1280, 1440 and 1920px
- page weight, request count and DOM size per page

Current state: no problems, and the heaviest page is 255 kB over 7 requests — most of
which is the two fonts, cached for every page after the first.

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
