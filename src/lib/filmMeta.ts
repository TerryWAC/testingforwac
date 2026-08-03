import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Progressive TMDB metadata cache. Each request resolves what's already in
 * the film_meta table instantly and fetches a bounded number of misses, so
 * the library's metadata coverage grows with every use.
 */

export interface FilmMeta {
  runtime: number | null;
  genres: number[];
  language: string | null;
  vote: number | null;
}

export const GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

interface MetaItem {
  slug: string;
  title: string;
  year: number | null;
}

/**
 * Read-only lookup against the cache — never fetches from TMDB.
 *
 * Used for taste modelling over the whole library, where we want whatever
 * coverage already exists and absolutely don't want to fire hundreds of
 * network calls. Coverage grows on its own as recommendations run.
 */
export async function getCachedMeta(slugs: string[]): Promise<Map<string, FilmMeta>> {
  const map = new Map<string, FilmMeta>();
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return map;

  const admin = createAdminClient();
  const page = 400;
  for (let i = 0; i < unique.length; i += page) {
    const { data, error } = await admin
      .from("film_meta")
      .select("slug, runtime, genre_ids, language, vote")
      .in("slug", unique.slice(i, i + page));
    if (error) break;
    for (const row of data ?? []) {
      map.set(row.slug, {
        runtime: row.runtime,
        genres: row.genre_ids ?? [],
        language: row.language,
        vote: row.vote !== null ? Number(row.vote) : null,
      });
    }
  }
  return map;
}

export async function getFilmMeta(
  items: MetaItem[],
  maxFetch = 12
): Promise<Map<string, FilmMeta>> {
  const map = new Map<string, FilmMeta>();
  if (items.length === 0) return map;

  const admin = createAdminClient();
  const slugs = [...new Set(items.map((i) => i.slug))].slice(0, 120);

  try {
    const { data } = await admin
      .from("film_meta")
      .select("slug, runtime, genre_ids, language, vote")
      .in("slug", slugs);
    for (const row of data ?? []) {
      map.set(row.slug, {
        runtime: row.runtime,
        genres: row.genre_ids ?? [],
        language: row.language,
        vote: row.vote !== null ? Number(row.vote) : null,
      });
    }
  } catch {
    return map; // table missing (migration not run) — engine degrades gracefully
  }

  const key = process.env.TMDB_API_KEY;
  if (!key) return map;

  const missing = items
    .filter((i, idx, arr) => !map.has(i.slug) && arr.findIndex((x) => x.slug === i.slug) === idx)
    .slice(0, maxFetch);

  await Promise.all(
    missing.map(async (item) => {
      try {
        const params = new URLSearchParams({
          api_key: key,
          query: item.title,
          include_adult: "false",
        });
        if (item.year) params.set("year", String(item.year));
        const search = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
          signal: AbortSignal.timeout(6000),
        }).then((r) => r.json());
        const hit = search?.results?.[0];

        let runtime: number | null = null;
        if (hit?.id) {
          const detail = await fetch(
            `https://api.themoviedb.org/3/movie/${hit.id}?api_key=${key}`,
            { signal: AbortSignal.timeout(6000) }
          ).then((r) => r.json());
          runtime =
            typeof detail?.runtime === "number" && detail.runtime > 0 ? detail.runtime : null;
        }

        const meta: FilmMeta = {
          runtime,
          genres: Array.isArray(hit?.genre_ids) ? hit.genre_ids : [],
          language: typeof hit?.original_language === "string" ? hit.original_language : null,
          vote:
            typeof hit?.vote_average === "number" && hit.vote_average > 0
              ? Math.round(hit.vote_average * 10) / 10
              : null,
        };
        map.set(item.slug, meta);

        // Persist even empty results so we never refetch the same miss.
        await admin.from("film_meta").upsert(
          {
            slug: item.slug,
            title: item.title,
            year: item.year,
            runtime: meta.runtime,
            genre_ids: meta.genres,
            language: meta.language,
            vote: meta.vote,
            popularity: typeof hit?.popularity === "number" ? hit.popularity : null,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        );
      } catch {}
    })
  );

  return map;
}
