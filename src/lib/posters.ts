import "server-only";

/**
 * Server-side TMDB poster lookup. The API key never reaches the client —
 * the browser only ever sees final image.tmdb.org URLs (public CDN links).
 * Optional: without TMDB_API_KEY the app falls back to typographic cards.
 */

// Bounded: an unbounded map grows for the whole life of a warm serverless
// instance, and a busy profile resolves thousands of distinct slugs.
const memoryCache = new Map<string, string | null>();
const CACHE_MAX = 2000;

function remember(slug: string, url: string | null) {
  if (memoryCache.size >= CACHE_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(slug, url);
}
const TMDB_SEARCH = "https://api.themoviedb.org/3/search/movie";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";

async function searchOnce(title: string, year: number | null): Promise<string | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    api_key: key,
    query: title,
    include_adult: "false",
  });
  if (year) params.set("year", String(year));

  const res = await fetch(`${TMDB_SEARCH}?${params}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const posterPath: string | undefined = data?.results?.[0]?.poster_path;
  return posterPath ? `${IMG_BASE}${posterPath}` : null;
}

export async function findPoster(
  slug: string,
  title: string,
  year: number | null
): Promise<string | null> {
  if (memoryCache.has(slug)) return memoryCache.get(slug)!;
  try {
    let url = await searchOnce(title, year);
    // Retry without the year filter — TMDB years occasionally differ by one.
    if (!url && year) url = await searchOnce(title, null);
    remember(slug, url);
    return url;
  } catch {
    return null; // don't cache transient failures
  }
}
