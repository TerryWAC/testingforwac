import "server-only";

import { GENRE_NAMES } from "@/lib/filmMeta";
import { MOOD_GENRES, type Candidate } from "@/lib/recommend";
import { deriveSlug } from "@/lib/slug";
import type { FilmRow, TonightFilters } from "@/lib/types";

/**
 * Discovery beyond the user's library, using TMDB's official Discover API.
 *
 * The curated catalog is ~160 hand-tagged films — fine as a floor, but a
 * heavy user exhausts it and then "discovery" stops discovering. This asks
 * TMDB for well-reviewed films matching tonight's filters and the genres the
 * user actually rates highly, then drops anything already in their library.
 *
 * Official API, no scraping. Results are cached in-process because the same
 * filter combination is asked for repeatedly across a session.
 */

const RUNTIME_LTE: Record<TonightFilters["runtimeCap"], number | null> = {
  under90: 95,
  under105: 110,
  under120: 125,
  under150: 155,
  any: null,
};

/** Inclusive release-date window for an era filter. */
function eraWindow(era: TonightFilters["era"]): { gte: string; lte: string } | null {
  if (era === "any") return null;
  if (era === "pre1970") return { gte: "1900-01-01", lte: "1969-12-31" };
  const start = parseInt(era, 10);
  return { gte: `${start}-01-01`, lte: `${start + 9}-12-31` };
}

interface DiscoverMovie {
  id: number;
  title?: string;
  release_date?: string;
  genre_ids?: number[];
  original_language?: string;
  vote_average?: number;
  vote_count?: number;
}

const CACHE_TTL_MS = 6 * 3600 * 1000;
const CACHE_MAX = 60;
const cache = new Map<string, { at: number; movies: DiscoverMovie[] }>();

async function discoverMovies(key: string, params: URLSearchParams): Promise<DiscoverMovie[]> {
  const cacheKey = params.toString();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.movies;

  const res = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`, {
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const movies: DiscoverMovie[] = Array.isArray(data?.results) ? data.results : [];

  // Bounded LRU-ish: drop the oldest entry once full.
  if (cache.size >= CACHE_MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(cacheKey, { at: Date.now(), movies });
  return movies;
}

export async function fetchDiscoverCandidates(
  filters: TonightFilters,
  library: FilmRow[],
  affinity: Map<number, number>,
  max = 12
): Promise<Candidate[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  // Everything the user has logged or watchlisted, by slug and by title, so
  // near-miss slugs still get excluded.
  const owned = new Set<string>();
  for (const f of library) {
    owned.add(f.film_slug);
    owned.add(deriveSlug(f.title, f.year));
    owned.add(deriveSlug(f.title));
  }

  // Mood genres, widened with the genres this user rates above their own
  // baseline. With no mood genres (a "classic" night) we lean entirely on
  // taste, and if we know neither we let TMDB rank on acclaim alone.
  const moodGenres = MOOD_GENRES[filters.mood] ?? [];
  const lovedGenres = [...affinity.entries()]
    .filter(([, delta]) => delta >= 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);
  const genres = moodGenres.length > 0 ? moodGenres : lovedGenres;

  const params = new URLSearchParams({
    api_key: key,
    include_adult: "false",
    include_video: "false",
    sort_by: "vote_average.desc",
    "vote_count.gte": "400",
  });
  if (genres.length > 0) params.set("with_genres", genres.join("|"));

  const runtimeLte = RUNTIME_LTE[filters.runtimeCap];
  if (runtimeLte !== null) params.set("with_runtime.lte", String(runtimeLte));

  const window = eraWindow(filters.era);
  if (window) {
    params.set("primary_release_date.gte", window.gte);
    params.set("primary_release_date.lte", window.lte);
  }
  if (filters.language === "english") params.set("with_original_language", "en");

  // Rotate the page by day so discovery isn't the same twenty films forever.
  // TMDB has no "not English" filter, so foreign nights are filtered below.
  const page = (Math.floor(Date.now() / 86_400_000) % 5) + 1;
  params.set("page", String(page));

  let movies: DiscoverMovie[];
  try {
    movies = await discoverMovies(filters.mood, params);
  } catch {
    return [];
  }

  const out: Candidate[] = [];
  for (const m of movies) {
    if (!m.title) continue;
    if (filters.language === "foreign" && m.original_language === "en") continue;

    const year = m.release_date ? Number(m.release_date.slice(0, 4)) || null : null;
    const slug = deriveSlug(m.title, year);
    if (owned.has(slug) || owned.has(deriveSlug(m.title))) continue;

    const genreIds = m.genre_ids ?? [];
    const deltas = genreIds
      .map((g) => affinity.get(g))
      .filter((d): d is number => d !== undefined);
    const taste = deltas.length > 0 ? deltas.reduce((s, d) => s + d, 0) / deltas.length : 0;
    const vote = typeof m.vote_average === "number" ? m.vote_average : null;

    const reasons: string[] = [];
    const lovedHit = genreIds.find((g) => (affinity.get(g) ?? 0) >= 0.25);
    if (lovedHit !== undefined && GENRE_NAMES[lovedHit]) {
      reasons.push(`You rate ${GENRE_NAMES[lovedHit].toLowerCase()} above your own average`);
    }
    if (vote !== null && vote >= 7.5) reasons.push(`Rated ${vote.toFixed(1)} on TMDB`);
    reasons.push("Not in your library yet");

    out.push({
      slug,
      title: m.title,
      year,
      // Sits just under a watchlist film (10) so the watchlist still leads,
      // but a strongly on-taste discovery can climb past a weak one.
      score: 7 + taste * 4 + (vote !== null ? Math.max(0, vote - 7) : 0),
      reasons,
      seen: false,
      discovery: true,
      vote,
      genreNames: genreIds
        .map((g) => GENRE_NAMES[g])
        .filter(Boolean)
        .slice(0, 3),
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, max);
}
