import "server-only";

import { GENRE_NAMES } from "@/lib/filmMeta";
import { MOOD_GENRES, type Candidate } from "@/lib/recommend";
import { deriveSlug } from "@/lib/slug";
import { getCultKeywordId, searchMovie, tmdbGet, tmdbKey, type TmdbMovie } from "@/lib/tmdb";
import type { FilmRow, TonightFilters } from "@/lib/types";

/**
 * Discovery beyond the user's own library, using TMDB's official API.
 *
 * The curated catalog is ~160 hand-tagged films — a fine floor, but a heavy
 * user exhausts it and then "discovery" stops discovering. Three sources run
 * here instead:
 *
 *   canon    the widely-agreed greats, heavily voted and highly rated
 *   cult     TMDB's "cult film" keyword — the midnight-movie shelf
 *   gem      strong ratings on a modest vote count: the genuinely overlooked
 *
 * plus "because you loved X", which seeds TMDB's own recommendation graph
 * with the films this user rated highest. That last one is the only source
 * that reacts to a specific film rather than a general profile.
 *
 * Everything is filtered against tonight's settings and the user's library,
 * and every call is cached. No scraping.
 */

const RUNTIME_LTE: Record<TonightFilters["runtimeCap"], number | null> = {
  under90: 95,
  under105: 110,
  under120: 125,
  under150: 155,
  any: null,
};

function eraWindow(era: TonightFilters["era"]): { gte: string; lte: string } | null {
  if (era === "any") return null;
  if (era === "pre1970") return { gte: "1900-01-01", lte: "1969-12-31" };
  const start = parseInt(era, 10);
  return { gte: `${start}-01-01`, lte: `${start + 9}-12-31` };
}

function inEraYear(year: number | null, era: TonightFilters["era"]): boolean {
  if (era === "any") return true;
  if (year === null) return false;
  if (era === "pre1970") return year < 1970;
  const start = parseInt(era, 10);
  return year >= start && year < start + 10;
}

/** Every slug and title-derived slug the user already has, for exclusion. */
function ownedSlugs(library: FilmRow[]): Set<string> {
  const owned = new Set<string>();
  for (const f of library) {
    owned.add(f.film_slug);
    owned.add(deriveSlug(f.title, f.year));
    owned.add(deriveSlug(f.title));
  }
  return owned;
}

interface LaneSpec {
  name: "canon" | "cult" | "gem";
  params: Record<string, string>;
  label: (year: number | null) => string;
  base: number;
}

async function laneSpecs(): Promise<LaneSpec[]> {
  const cultId = await getCultKeywordId();
  const lanes: LaneSpec[] = [
    {
      name: "canon",
      params: { "vote_count.gte": "3000", "vote_average.gte": "7.5" },
      label: (y) => (y && y < 1985 ? "A canonical classic you haven't logged" : "Widely held as a great"),
      base: 7,
    },
    {
      name: "gem",
      params: {
        "vote_count.gte": "200",
        "vote_count.lte": "2500",
        "vote_average.gte": "7.2",
      },
      label: () => "An overlooked pick — loved by the few who found it",
      base: 6.5,
    },
  ];
  if (cultId !== null) {
    lanes.splice(1, 0, {
      name: "cult",
      params: { with_keywords: String(cultId), "vote_count.gte": "150", "vote_average.gte": "6.5" },
      label: () => "A cult favourite outside your library",
      base: 6.8,
    });
  }
  return lanes;
}

function scoreExternal(
  m: TmdbMovie,
  affinity: Map<number, number>,
  base: number
): { score: number; reasons: string[]; genreNames: string[]; vote: number | null } {
  const genreIds = m.genre_ids ?? [];
  const deltas = genreIds.map((g) => affinity.get(g)).filter((d): d is number => d !== undefined);
  const taste = deltas.length > 0 ? deltas.reduce((s, d) => s + d, 0) / deltas.length : 0;
  const vote = typeof m.vote_average === "number" ? m.vote_average : null;

  const reasons: string[] = [];
  const lovedHit = genreIds.find((g) => (affinity.get(g) ?? 0) >= 0.25);
  if (lovedHit !== undefined && GENRE_NAMES[lovedHit]) {
    reasons.push(`You rate ${GENRE_NAMES[lovedHit].toLowerCase()} above your own average`);
  }
  if (vote !== null && vote >= 7.5) reasons.push(`Rated ${vote.toFixed(1)} on TMDB`);

  return {
    // Sits just under a watchlist film (10) so the watchlist still leads, but
    // a strongly on-taste discovery can climb past a weak watchlist entry.
    score: base + taste * 4 + (vote !== null ? Math.max(0, vote - 7) : 0),
    reasons,
    genreNames: genreIds
      .map((g) => GENRE_NAMES[g])
      .filter(Boolean)
      .slice(0, 3),
    vote,
  };
}

/** Canon / cult / gem lanes, mixed so one set of picks spans all three. */
async function fetchLanes(
  filters: TonightFilters,
  owned: Set<string>,
  affinity: Map<number, number>,
  perLane: number
): Promise<Candidate[]> {
  const moodGenres = MOOD_GENRES[filters.mood] ?? [];
  const lovedGenres = [...affinity.entries()]
    .filter(([, delta]) => delta >= 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);
  const genres = moodGenres.length > 0 ? moodGenres : lovedGenres;

  const shared: Record<string, string> = {
    include_adult: "false",
    include_video: "false",
    sort_by: "vote_average.desc",
  };
  if (genres.length > 0) shared.with_genres = genres.join("|");

  const runtimeLte = RUNTIME_LTE[filters.runtimeCap];
  if (runtimeLte !== null) shared["with_runtime.lte"] = String(runtimeLte);

  const window = eraWindow(filters.era);
  if (window) {
    shared["primary_release_date.gte"] = window.gte;
    shared["primary_release_date.lte"] = window.lte;
  }
  if (filters.language === "english") shared.with_original_language = "en";

  // Rotate the page by day so discovery isn't the same twenty films forever.
  const page = String((Math.floor(Date.now() / 86_400_000) % 5) + 1);

  const lanes = await laneSpecs();
  const results = await Promise.all(
    lanes.map(async (lane) => {
      const data = await tmdbGet<{ results?: TmdbMovie[] }>("/discover/movie", {
        ...shared,
        ...lane.params,
        page,
      });
      const out: Candidate[] = [];
      for (const m of data?.results ?? []) {
        if (!m.title) continue;
        // TMDB has no "not English" filter, so foreign nights filter here.
        if (filters.language === "foreign" && m.original_language === "en") continue;

        const year = m.release_date ? Number(m.release_date.slice(0, 4)) || null : null;
        const slug = deriveSlug(m.title, year);
        if (owned.has(slug) || owned.has(deriveSlug(m.title))) continue;

        const scored = scoreExternal(m, affinity, lane.base);
        out.push({
          slug,
          title: m.title,
          year,
          score: scored.score,
          reasons: [...scored.reasons, lane.label(year)],
          seen: false,
          discovery: true,
          vote: scored.vote,
          genreNames: scored.genreNames,
        });
      }
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, perLane);
    })
  );

  return results.flat();
}

/**
 * "Because you loved X" — TMDB's recommendation graph, seeded with the films
 * this user rated highest. Seeds rotate daily so the same two favourites
 * don't drive recommendations forever.
 */
async function fetchBecauseYouLoved(
  filters: TonightFilters,
  library: FilmRow[],
  owned: Set<string>,
  affinity: Map<number, number>,
  max: number
): Promise<Candidate[]> {
  // Best-rated distinct films, most recent watch first as a tiebreak.
  const best = new Map<string, FilmRow>();
  for (const f of library) {
    if (f.rating === null || f.rating < 4.5 || f.entry_type === "watchlist") continue;
    const existing = best.get(f.film_slug);
    if (!existing || (f.rating ?? 0) > (existing.rating ?? 0)) best.set(f.film_slug, f);
  }
  const seedPool = [...best.values()].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (seedPool.length === 0) return [];

  // Two distinct seeds, offset so they aren't adjacent in the ranking.
  const day = Math.floor(Date.now() / 86_400_000);
  const seeds = [
    ...new Map(
      [0, 1]
        .map((i) => seedPool[(day + i * 7) % seedPool.length])
        .map((f) => [f.film_slug, f] as const)
    ).values(),
  ];

  const perSeed = Math.max(2, Math.ceil(max / seeds.length));
  const results = await Promise.all(
    seeds.map(async (seed) => {
      const found = await searchMovie(seed.title, seed.year);
      if (!found) return [];
      const data = await tmdbGet<{ results?: TmdbMovie[] }>(
        `/movie/${found.id}/recommendations`,
        {}
      );

      const out: Candidate[] = [];
      for (const m of data?.results ?? []) {
        if (!m.title) continue;
        if (filters.language === "english" && m.original_language !== "en") continue;
        if (filters.language === "foreign" && m.original_language === "en") continue;

        const year = m.release_date ? Number(m.release_date.slice(0, 4)) || null : null;
        if (!inEraYear(year, filters.era)) continue;

        const slug = deriveSlug(m.title, year);
        if (owned.has(slug) || owned.has(deriveSlug(m.title))) continue;

        const scored = scoreExternal(m, affinity, 8);
        out.push({
          slug,
          title: m.title,
          year,
          score: scored.score,
          reasons: [
            `Because you gave ${seed.title} ${seed.rating}★`,
            ...scored.reasons,
          ],
          seen: false,
          discovery: true,
          vote: scored.vote,
          genreNames: scored.genreNames,
        });
      }
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, perSeed);
    })
  );

  return results.flat();
}

/**
 * All external discovery for one request. Sources run concurrently and each
 * failure is contained — a dead lane costs variety, never the whole request.
 */
export async function fetchDiscoverCandidates(
  filters: TonightFilters,
  library: FilmRow[],
  affinity: Map<number, number>,
  max = 16
): Promise<Candidate[]> {
  if (!tmdbKey()) return [];
  const owned = ownedSlugs(library);

  const [lanes, loved] = await Promise.all([
    fetchLanes(filters, owned, affinity, Math.max(3, Math.floor(max / 4))).catch(() => []),
    fetchBecauseYouLoved(filters, library, owned, affinity, Math.max(4, Math.floor(max / 3))).catch(
      () => []
    ),
  ]);

  // Dedupe across sources, keeping the higher-scoring reason set.
  const bySlug = new Map<string, Candidate>();
  for (const c of [...loved, ...lanes]) {
    const existing = bySlug.get(c.slug);
    if (!existing || c.score > existing.score) bySlug.set(c.slug, c);
  }

  return [...bySlug.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/**
 * Verify AI-suggested titles against TMDB.
 *
 * A language model naming films is useful but unreliable — it invents
 * plausible titles and misremembers years. Every suggestion is resolved
 * through TMDB search: anything that doesn't exist is dropped, and anything
 * that does comes back with a real year, real genres and a real slug rather
 * than the model's guess.
 */
export async function verifySuggestions(
  suggestions: { title: string; year: number | null }[],
  filters: TonightFilters,
  library: FilmRow[],
  affinity: Map<number, number>,
  max = 8
): Promise<Candidate[]> {
  if (!tmdbKey() || suggestions.length === 0) return [];
  const owned = ownedSlugs(library);

  const resolved = await Promise.all(
    suggestions.slice(0, 12).map(async (s) => {
      const m = await searchMovie(s.title, s.year);
      if (!m?.title) return null;

      const year = m.release_date ? Number(m.release_date.slice(0, 4)) || null : null;
      if (!inEraYear(year, filters.era)) return null;
      if (filters.language === "english" && m.original_language !== "en") return null;
      if (filters.language === "foreign" && m.original_language === "en") return null;

      const slug = deriveSlug(m.title, year);
      if (owned.has(slug) || owned.has(deriveSlug(m.title))) return null;

      const scored = scoreExternal(m, affinity, 7.5);
      return {
        slug,
        title: m.title,
        year,
        score: scored.score,
        reasons: [...scored.reasons, "A deep cut for tonight's mood"],
        seen: false,
        discovery: true,
        vote: scored.vote,
        genreNames: scored.genreNames,
      } satisfies Candidate;
    })
  );

  const bySlug = new Map<string, Candidate>();
  for (const c of resolved) {
    if (c && !bySlug.has(c.slug)) bySlug.set(c.slug, c);
  }
  return [...bySlug.values()].sort((a, b) => b.score - a.score).slice(0, max);
}
