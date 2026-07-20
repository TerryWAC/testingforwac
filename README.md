# Letterboxd Night

Turn your Letterboxd library into tonight's perfect pick. Mobile-first Next.js app:
import your official Letterboxd export **once**, keep it fresh automatically, and get
metadata-driven recommendations plus a dozen ways to actually decide what to watch.

- **No scraping** — only the official export ZIP, your public feed, and the TMDB API.
- **Import once** — films live in Supabase Postgres; new watches sync automatically.
- **Metadata brain** — genres, runtimes, languages and ratings are learned progressively
  (film_meta), so mood/runtime/language filters work for real.
- **AI polish** — one Gemini call per request, cached 24h, 10/day per user, always
  falling back to the deterministic engine.

## Features

**Ways to pick:** Recommend (mood/era/intensity/runtime/language + curfew mode) ·
Final Cut knockout tournament · Veto Draft elimination · Spin the Wheel · Lucky Slots ·
Movie Match swipe deck · Double Feature (same era / contrast / marathon / by director,
with combined runtimes) · Coin Flip · guided Chat

**Explore:** Coming Soon release calendar (watchlist-matched) · Directors & Actors
filmography coverage · The Gauntlet daily challenges · Your Stats (heatmap, histogram,
decades, the "Build" analyzer with levels/archetypes/tiers) · Wrapped year-in-film

**Together:** Compare sessions with join codes and shareable invite links · RSS-only
guest profiles · compromise picks · Friends with growing libraries, avatars and builds

**Everything else:** film info sheets (your rating, watches, review, where-to-watch,
Stremio, Tonight Mode) · reviews import · achievements · On This Day · PWA install ·
haptics · confetti · 3D tilt everywhere

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres) ·
TMDB (server-side) · Gemini (server-side, optional)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run each file in `supabase/migrations/` in order
   (0001 → 0004).
3. **Authentication → URL Configuration**:
   - Set **Site URL** to your app URL (`http://localhost:3000` for dev, your prod URL later).
   - Add `<url>/auth/callback` to **Redirect URLs**.
4. **Settings → API**: copy the project URL, publishable key and secret key into env vars.

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Publishable key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Never commit, never expose |
| `GEMINI_API_KEY` | **server only** | Optional — deterministic engine runs without it |
| `TMDB_API_KEY` | **server only** | Optional but recommended — posters, metadata, calendar, people search |

**Never commit real values.** `.env*` files are gitignored. Rotate any key that has ever
been pasted into a chat or client-side code.

## Deploy to Vercel

1. Push this repo to GitHub and import it in [vercel.com](https://vercel.com).
2. Add the env vars above (Project → Settings → Environment Variables).
3. Deploy, then update Supabase's Site URL / Redirect URLs to the Vercel domain.

## Where users get their Letterboxd data

- **Export ZIP**: [letterboxd.com/user/exportdata](https://letterboxd.com/user/exportdata) —
  uploaded once on `/setup`; diary, watched, ratings, watchlist and reviews all import.
- Afterwards the library updates itself from the user's public feed (auto-sync when
  stale, manual Refresh button). Friends' libraries grow the same way.
