# Auth email templates

Supabase ships plain, unbranded auth emails. These replace them.

## Where they go

Supabase Dashboard → **Authentication** → **Emails** → **Templates**.

| File | Template to paste into | Suggested subject |
| --- | --- | --- |
| `magic-link.html` | Magic Link | `Your Letterboxd Night sign-in link` |
| `confirm-signup.html` | Confirm signup | `Welcome to Letterboxd Night` |

Paste the file contents into the **Message body** box, set the subject, save.

**Do both.** Supabase picks the template by whether the address already
exists: a returning user gets Magic Link, a brand new address gets Confirm
signup. Style only one and half your users still get the stock email.

## Template variables

Supabase substitutes these server-side — leave them exactly as written:

- `{{ .ConfirmationURL }}` — the one-time sign-in link
- `{{ .Token }}` — the 6-digit code, offered as a fallback for mail apps that
  mangle links

## Why the markup looks like 2005

Gmail, Outlook and Apple Mail strip `<style>` blocks and external stylesheets,
so every rule is inlined on the element and the layout is nested tables. There
are no images and no web fonts, so nothing can fail to load or get blocked by
a privacy proxy.

## Deliverability

The built-in Supabase mailer is rate-limited to a handful of messages per hour
and sends from a shared domain that lands in spam more often than not. Before
sharing the app with anyone, set up custom SMTP under
**Authentication → Emails → SMTP Settings** — Resend and Postmark both have
free tiers that are plenty for this. Branded templates sent from a shared IP
still get filtered; the sending domain is what actually moves the needle.
