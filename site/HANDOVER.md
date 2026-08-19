# What we need from Sam

Everything on the site works. What's missing is the information only Sam can
supply. This is the whole list, ordered so the site can go live as soon as
sections 1 and 2 come back.

Most of section 2 can be lifted straight off the old site automatically —
see **[Fastest route](#fastest-route)** at the bottom.

---

## 1. Blocks launch — legal and regulatory

The site cannot be published without these. They are not things anyone can
guess, and getting them wrong is an FCA problem, not a typo.

| What | Where it goes | Why it matters |
|---|---|---|
| **Registered firm name** | footer, privacy notice | The name on the FCA register, not the trading name |
| **Network / principal firm** | footer, privacy notice | Whether he's an appointed representative or directly authorised — the wording differs |
| **FCA firm reference number (FRN)** | footer, privacy notice | Must match the Financial Services Register |
| **Fee model, stated exactly** | footer, FAQ "What do you charge?" | Fees must be disclosed clearly and up front. Either "no broker fee, paid by lender commission" or "£X payable on offer" — and it must be accurate |
| **Company number + registered office** | footer | Required on a business website under the Companies Act |
| **ICO registration number** | privacy notice | Brokers generally must register as a data controller |
| **Data retention periods** | privacy notice | How long client records are kept. Usually six years plus for mortgage advice — his network will have a policy |
| **Whole-of-market or panel?** | FAQ, and the Initial Disclosure Document | If it's a panel, say so and say how many lenders. This must be true |

> **Worth doing:** send the footer and privacy notice to his network's compliance
> team before launch. They will usually supply approved wording, which is faster
> and safer than drafting it.

## 2. Blocks launch — business basics

| What | Notes |
|---|---|
| **Sam's surname** | Appears in the header, footer, share card and structured data |
| **Phone number** | Also needs the international form for the click-to-call links, e.g. `+447700900123` |
| **Email address** | Where enquiries land |
| **Office address, town, region, postcode** | Used in the local-business structured data that helps him show up in local search |
| **Opening hours** | Including whether he really does evenings and weekends — the site currently claims he does |
| **Domain name** | See section 5 |

## 3. Blocks launch — claims we must not invent

The trust bar and the reviews are currently obvious placeholders. They are
deliberately **not** fillable by the setup script, because they are public
claims about the business.

- **Mortgages arranged** — a real figure, or delete the tile
- **Total lending secured** — same
- **Average review score, and where it's from** — Google, Trustpilot, VouchedFor
- **Three genuine client reviews**, with first name, town and month

Testimonials have to be real, verifiable and held on file. If the numbers
aren't to hand, **delete the trust bar** — an empty space is better than a
number he can't evidence.

## 4. Needed before leads arrive

- **Where should enquiries go?** An email address is fine to start. The form
  posts to whatever endpoint we point it at — Formspree, Netlify Forms, or his
  own CRM.
- **Should rate-expiry reminders go somewhere separate?** They're a different
  kind of lead from an enquiry and usually want a different follow-up. Worth
  keeping apart from day one.
- **Number of lenders** — the site says "[90+] lenders searched". Needs his real
  figure or the claim goes.

## 5. Decisions, not information

- **The domain.** A `.chatgpt.site` subdomain isn't his, can't be moved, and
  reads as temporary to anyone comparing brokers. A proper domain is the single
  highest-value change on this list after compliance.
- **A photo of Sam.** For a personal-brand broker this measurably outperforms an
  illustration. Head and shoulders, natural light, no suit required.
- **Does he want analytics?** Nothing on the site sets a cookie today, which is
  why there's no consent banner. Adding Google Analytics changes that — he'd need
  a banner and a privacy-notice update.

## 6. Useful, not blocking

- Social profile links for the footer
- Which lenders or awards he's allowed to display logos for
- Anything he wants to say about his own story — the "about" copy is currently
  generic, and this is the part clients actually connect with

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
