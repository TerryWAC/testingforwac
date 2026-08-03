# Auth email templates

Supabase ships plain, unbranded auth emails. These replace them.

## Where they go

Supabase Dashboard → **Authentication** → **Emails** → **Templates**. Paste the
file contents into **Message body**, set the subject, save.

| File | Template | Subject |
| --- | --- | --- |
| `magic-link.html` | Magic Link | `Your sign-in link for Letterboxd Night` |
| `confirm-signup.html` | Confirm signup | `Welcome to Letterboxd Night` |
| `change-email.html` | Change Email Address | `Confirm your new email address` |

**Do the first two at minimum.** Supabase picks between them by whether the
address already exists: a returning user gets Magic Link, a brand-new address
gets Confirm signup. Style only one and half your users still get the stock
email. The third only fires if an account's email is changed — the app has no
UI for that today, so it's there to stop the stock template leaking through if
you add one.

The remaining Supabase templates (Invite user, Reset password,
Reauthentication) are never triggered by this app, which is passwordless and
invite-free. Leave them.

## Template variables

Supabase substitutes these server-side — leave them exactly as written:

| Variable | Meaning |
| --- | --- |
| `{{ .ConfirmationURL }}` | The one-time action link |
| `{{ .Token }}` | 6-digit code, offered as a fallback for mail apps that mangle links |
| `{{ .Email }}` | The recipient's current address |
| `{{ .NewEmail }}` | The requested new address (change-email only) |

## Why the markup looks like 2005

Because email clients are still there.

- **Every style is inlined.** Gmail, Outlook and Yahoo strip `<style>` blocks.
- **Layout is nested tables.** Outlook renders with Word, which has no flexbox
  and no grid.
- **The button is doubled.** Outlook ignores padding on anchors and would show
  a bare text link, so there's a VML rounded rectangle behind an `[if mso]`
  conditional and a normal anchor for everything else.
- **Dark backgrounds are set twice**, as `bgcolor` and inline
  `background-color`, because some clients honour only one.
- **No images, no web fonts.** Nothing to be blocked by a privacy proxy or
  fail to load on a bad connection.
- **`mso-line-height-rule: exactly`** stops Outlook inventing its own leading.
- **Hidden preheader text** controls the grey preview line next to the subject
  in the inbox list, instead of letting the client scrape whatever body copy
  it finds first.

## Deliverability

Templates change how the email *looks*. They do nothing for whether it
*arrives*.

Supabase's built-in mailer is rate-limited to a handful of messages per hour
and sends from a shared domain that lands in spam more often than not. Before
sharing the app with anyone, set up custom SMTP under **Authentication →
Emails → SMTP Settings**. Resend and Postmark both have free tiers that are
ample here. The sending domain — and SPF/DKIM on it — is what actually moves
inbox placement.
