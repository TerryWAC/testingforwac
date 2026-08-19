# What we need from Sam

The site is built, tested and reads as finished. Nothing shows as a placeholder
to a visitor.

**Four regulatory details are all that block publication.** Everything else in
this list improves the site but is optional — anything not supplied is simply
removed from the page rather than displayed as a gap.

If the old site's page source can be recovered, most of section 2 imports
automatically — see **[Fastest route](#fastest-route)** at the bottom.

---

## 1. Blocks launch — four regulatory details

**These four are the only things standing between the site and going live.**
They cannot be guessed, and getting them wrong is an FCA problem rather than a typo.

| What | Where it goes |
|---|---|
| **Registered firm name** | footer, privacy notice — the name on the FCA register, not the trading name |
| **Network / principal firm** | footer, privacy notice — the firm he's an appointed representative of |
| **FCA firm reference number (FRN)** | footer, privacy notice — must match the Financial Services Register |
| **Company number** | footer — required on a business website under the Companies Act |

`./fill-placeholders.sh` refuses to report the site as ready while any of these
is blank, and names the ones still outstanding.

Two more that aren't tokens, but should be checked before launch:

- **The fee wording.** The footer carries a bracketed note where it belongs.
  Either "no broker fee, paid by lender commission" or "£X payable on offer" —
  it just has to be accurate and up front.
- **Whole-of-market or panel?** The site currently says whole of market. If it's
  a panel, that needs changing, and it must match his Initial Disclosure Document.

> Send the footer and privacy notice to his network's compliance team. They will
> usually supply approved wording, which is faster and safer than drafting it.

## 2. Improves the site — but nothing breaks without them

Anything left blank is **removed from the page entirely** rather than shown as a
placeholder, so the site reads as finished either way. Add them whenever they arrive
and re-run the fill script.

| What | Effect if missing |
|---|---|
| **Phone number** | The "Call or text" row, the footer link and the sticky mobile Call button all disappear. The form carries every enquiry instead |
| **Email address** | The email row and footer link disappear |
| **Office address** | The registered-office sentence is omitted from the footer |
| **Opening hours** | Currently "Weekdays 9am–6pm, evenings and weekends by arrangement" — correct it if that's wrong |

## 3. Claims and reviews — deliberately left out

The site ships with **no invented numbers and no placeholder reviews**. The trust
bar states only things that are true by construction (whole of market, free initial
consultation, 24-hour decision in principle, one point of contact), and the reviews
section has been replaced with a "Four things I'll always do" section that stands
on its own.

If and when there are genuine reviews:

- Paste the block from `REVIEWS-TEMPLATE.html` into the `#reviews` section
- First name and initial, town, month — and hold the originals on file
- Two real ones beat three invented ones

Same for any statistic. To add one with an animated count, put
`data-count-to="450"` on the element. Only with a figure that can be evidenced.

## 4. Needed before leads arrive

- **Where should enquiries go?** An email address is enough to start. The form
  posts wherever we point it — Formspree, Netlify Forms, or his own CRM.
- **Should rate-expiry reminders go somewhere separate?** They're a different kind
  of lead and usually want different follow-up. Worth splitting from day one.

## 5. Decisions, not information

- **The domain.** The site is currently configured for
  `mortgage-fixer-sam.terry-blackburn.chatgpt.site`, so it works at its present
  address today. But that subdomain isn't his, can't be moved, and reads as
  temporary to anyone comparing brokers. Change one line in `config.json` when a
  real domain is bought.
- **A photo of Sam.** For a personal-brand broker this measurably outperforms an
  illustration.
- **Analytics?** Nothing sets a cookie today, which is why there's no consent
  banner. Adding Google Analytics changes that.

## 6. Content he might want to review

Three guides are live at `/guides/` — deposits, remortgage timing, and
self-employed income. They are general information about how UK mortgages work
rather than advice, and each says so.

Worth Sam reading them once, because they speak in his voice and carry his name.
If anything doesn't match how he actually works, the text is all in one file
(`guides/_content.js`) and takes a minute to change.

## 7. Useful, not blocking

- Social profile links for the footer
- Sam's own story — the "about" copy is generic, and this is the part clients
  actually connect with
- Which lender or award logos he's permitted to display

---

## Fastest route

If we can get the **old site's page source**, most of section 2 imports
automatically:

1. Open the old site, press `Ctrl+U` (or `Cmd+Option+U`), select all, copy.
2. Save it as `old-site.html`.
3. Run:

```bash
cd site
node import-from-old-site.js old-site.html
./fill-placeholders.sh
```

The importer pulls out the phone, email, firm name, network, FRN, company
number, address, town, postcode, domain and surname, and reports anything it
couldn't find. It never overwrites a value already filled in, so it's safe to
re-run.

It also surfaces the old opening hours, social links and any testimonials it
finds — but it will **not** put reviews back on the site automatically. Those
get copied across by hand, once confirmed genuine.

Whatever it can't find becomes the list to send Sam.

---

## Checking it's ready

```bash
cd site
grep -rn "\[[A-Z][A-Z ]*\]" index.html privacy.html 404.html   # anything left?
cd test && npm install && npm test                              # 79 checks
```

The site is ready to publish when the first command returns nothing and the
second passes.
