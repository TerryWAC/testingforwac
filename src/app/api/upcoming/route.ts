import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REGION = "GB";
const CACHE_TTL_MS = 6 * 3600 * 1000;

interface ReleaseItem {
  title: string;
  year: number | null;
  date: string; // YYYY-MM-DD regional release date
  posterUrl: string | null;
  onWatchlist?: boolean;
}

const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

let cache: { t: number; data: { nowPlaying: ReleaseItem[]; upcoming: ReleaseItem[] } } | null =
  null;

interface TmdbMovie {
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  popularity?: number;
}

async function tmdbList(path: string, key: string, page = 1): Promise<TmdbMovie[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${path}?api_key=${key}&region=${REGION}&page=${page}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}

function toItem(m: TmdbMovie): ReleaseItem | null {
  if (!m.title || !m.release_date) return null;
  return {
    title: m.title,
    year: Number(m.release_date.slice(0, 4)) || null,
    date: m.release_date,
    posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
  };
}

/** GET /api/upcoming — cinema releases: now playing + coming soon (TMDB). */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json({ enabled: false });

  // The user's watchlist titles — upcoming releases they've already
  // watchlisted on Letterboxd are the truest "recommended for you" signal.
  const watchlistTitles = new Set<string>();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile) {
    const admin = createAdminClient();
    const { data: wl } = await admin
      .from("films")
      .select("title")
      .eq("profile_id", profile.id)
      .eq("entry_type", "watchlist");
    for (const f of wl ?? []) watchlistTitles.add(normalize(f.title));
  }

  const withFlags = (items: ReleaseItem[]) =>
    items.map((m) => ({ ...m, onWatchlist: watchlistTitles.has(normalize(m.title)) }));

  if (cache && Date.now() - cache.t < CACHE_TTL_MS) {
    return NextResponse.json({
      enabled: true,
      nowPlaying: withFlags(cache.data.nowPlaying),
      upcoming: withFlags(cache.data.upcoming),
    });
  }

  try {
    const [nowRaw, up1, up2] = await Promise.all([
      tmdbList("now_playing", key),
      tmdbList("upcoming", key, 1),
      tmdbList("upcoming", key, 2),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();

    const nowPlaying = nowRaw
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .map(toItem)
      .filter((m): m is ReleaseItem => m !== null && m.date <= today)
      .filter((m) => !seen.has(m.title) && seen.add(m.title))
      .slice(0, 16);

    const upcoming = [...up1, ...up2]
      .map(toItem)
      .filter((m): m is ReleaseItem => m !== null && m.date > today)
      .filter((m) => !seen.has(m.title) && seen.add(m.title))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 40);

    cache = { t: Date.now(), data: { nowPlaying, upcoming } };
    return NextResponse.json({
      enabled: true,
      nowPlaying: withFlags(nowPlaying),
      upcoming: withFlags(upcoming),
    });
  } catch {
    return NextResponse.json({ enabled: true, nowPlaying: [], upcoming: [] });
  }
}
