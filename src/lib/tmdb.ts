import "server-only";

/**
 * Shared TMDB access: a bounded response cache and the handful of lookups
 * several features need. Official API only — no scraping anywhere in this app.
 */

const BASE = "https://api.themoviedb.org/3";
const TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 6 * 3600 * 1000;
const CACHE_MAX = 200;

const cache = new Map<string, { at: number; body: unknown }>();

export function tmdbKey(): string | null {
  return process.env.TMDB_API_KEY ?? null;
}

/**
 * GET a TMDB path with caching. Returns null on any failure — every caller
 * treats TMDB as an optional enrichment, never a dependency.
 */
export async function tmdbGet<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = tmdbKey();
  if (!key) return null;

  const query = new URLSearchParams({ ...params, api_key: key });
  const cacheKey = `${path}?${query.toString()}`;

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body as T;

  try {
    const res = await fetch(`${BASE}${path}?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as T;

    if (cache.size >= CACHE_MAX) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    cache.set(cacheKey, { at: Date.now(), body });
    return body;
  } catch {
    return null;
  }
}

export interface TmdbMovie {
  id: number;
  title?: string;
  release_date?: string;
  genre_ids?: number[];
  original_language?: string;
  vote_average?: number;
  vote_count?: number;
}

/** Resolve a title (and year, when known) to a TMDB movie. */
export async function searchMovie(title: string, year: number | null): Promise<TmdbMovie | null> {
  const params: Record<string, string> = { query: title, include_adult: "false" };
  if (year) params.year = String(year);
  const data = await tmdbGet<{ results?: TmdbMovie[] }>("/search/movie", params);
  return data?.results?.[0] ?? null;
}

let cultKeywordId: number | null | undefined;

/**
 * TMDB's "cult film" keyword id, looked up once rather than hardcoded — the
 * numeric ids aren't documented and guessing one would silently return the
 * wrong genre of film forever.
 */
export async function getCultKeywordId(): Promise<number | null> {
  if (cultKeywordId !== undefined) return cultKeywordId;
  const data = await tmdbGet<{ results?: { id: number; name: string }[] }>("/search/keyword", {
    query: "cult film",
  });
  const exact = data?.results?.find((k) => k.name.toLowerCase() === "cult film");
  cultKeywordId = exact?.id ?? data?.results?.[0]?.id ?? null;
  return cultKeywordId;
}
