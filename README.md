# Letterboxd Night 🎬

Turn your Letterboxd library into tonight's perfect pick. Mobile-first Next.js app:
import your official Letterboxd export **once**, keep it fresh automatically via RSS,
and get AI-polished recommendations (with a deterministic fallback that always works).

- **No scraping** — only the official export ZIP + your public RSS feed.
- **Import once** — films live in Supabase Postgres; RSS auto-syncs new watches.
- **Compare mode** — up to 3 profiles via join codes, with compromise picks.
- **AI polish** — one Gemini call per request, cached 24h, 10/day per user, always
  falls back to the deterministic engine.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres) · Gemini (server-only)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run `supabase/migrations/0001_init.sql`.
3. **Authentication → URL Configuration**:
   - Set **Site URL** to your app URL (`http://localhost:3000` for dev, your Vercel URL in prod).
   - Add `http://localhost:3000/auth/callback` (and the prod equivalent) to **Redirect URLs**.
4. **Settings → API**: copy the project URL, the publishable (anon) key, and the secret
   (service role) key into your env vars.

> Magic-link emails on the free tier are rate-limited (~1/minute). For production
> volume, configure a custom SMTP provider under **Authentication → Emails**.

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Publishable key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Never commit, never expose |
| `GEMINI_API_KEY` | **server only** | Optional — without it the deterministic engine runs alone |

**Never commit real values.** `.env*` files are gitignored. If a secret key has ever
been pasted into a chat, shared doc, or client-side code, rotate it in the dashboard.

## Deploy to Vercel

1. Push this repo to GitHub and import it in [vercel.com](https://vercel.com).
2. Add the four env vars above (Project → Settings → Environment Variables).
3. Deploy, then update Supabase's Site URL / Redirect URLs to the Vercel domain.

## Where users get their Letterboxd data

- **Export ZIP**: [letterboxd.com/user/exportdata](https://letterboxd.com/user/exportdata)
  (Settings → Data → Export your data). Upload the ZIP as-is on `/setup`.
- **RSS feed**: `https://letterboxd.com/<username>/rss/` — auto-filled during setup.
  The dashboard auto-syncs when the library is >6h stale; there's a manual Sync button too.

## How it works

- **Import** (`/api/import`): parses `diary.csv`, `watched.csv`, `ratings.csv`,
  `watchlist.csv` from the ZIP server-side, normalizes rows (slug from the Letterboxd
  URL when present), stores them in Postgres. The ZIP is never persisted.
- **Sync** (`/api/sync`): server-side RSS fetch → new diary entries upserted.
- **Recommend** (`/api/ai/recommend`): Stage 1 builds ≤20 deterministic candidates from
  the user's watchlist/ratings/decade preferences. Stage 2 makes exactly one Gemini call
  to rank and write short "why" blurbs — cached 24h in `ai_cache`, limited to 10/day per
  user in `ai_usage`, and any failure returns Stage 1 results with template blurbs.
- **Compare**: sessions with 6-char join codes; libraries are only visible to session
  members (enforced server-side). RSS-only guest profiles support friends without accounts.
