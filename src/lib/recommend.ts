import { CATALOG } from "@/lib/catalog";
import { deriveSlug } from "@/lib/slug";
import type { FilmRow, Pick, RuntimeCap, TonightFilters } from "@/lib/types";

export interface Candidate {
  slug: string;
  title: string;
  year: number | null;
  score: number;
  reasons: string[];
  seen: boolean;
  discovery?: boolean;
  // Enriched by refineCandidates when metadata is known.
  runtime?: number | null;
  genreNames?: string[];
  vote?: number | null;
}

const INTENSITY_ORDER = ["light", "medium", "heavy", "extreme"];
const RUNTIME_MAX: Record<RuntimeCap, number> = {
  under90: 95,
  under105: 110,
  under120: 125,
  under150: 155,
  any: 100000,
};

const MOOD_LABEL: Record<TonightFilters["mood"], string> = {
  comedy: "a comedy night",
  date: "date night",
  thriller: "a thriller night",
  horror: "a horror night",
  action: "an action night",
  romance: "a romance night",
  weird: "something weird",
  mindbender: "a mind-bender",
  feelgood: "a feel-good night",
  tearjerker: "a tearjerker",
  classic: "a classic night",
  easy: "an easy watch",
};

/** True when a film's year falls inside the chosen era. */
function inEra(year: number | null, era: TonightFilters["era"]): boolean {
  if (era === "any") return true;
  if (year === null) return false;
  if (era === "pre1970") return year < 1970;
  const start = parseInt(era, 10);
  return year >= start && year < start + 10;
}

/**
 * Stage 1 — deterministic candidate builder. Free, instant, and the fallback
 * whenever AI is unavailable. Works purely from the user's own stored library
 * (watchlist + watch history); we deliberately have no external film catalog.
 */
/**
 * discoverFrom: library used to exclude already-seen films from discovery
 * blending. Pass null to disable discovery entirely (pure library picks).
 * Defaults to the same films list.
 */
export function buildCandidates(
  films: FilmRow[],
  filters: TonightFilters,
  max = 20,
  discoverFrom: FilmRow[] | null | undefined = undefined
): Candidate[] {
  const watchedSlugs = new Set(
    films.filter((f) => f.entry_type !== "watchlist").map((f) => f.film_slug)
  );

  // Taste signals from rated films — one vote per film, so a decade you
  // rewatch a lot doesn't outrank a decade you simply rate higher.
  const ratedByDecade = new Map<number, { total: number; count: number }>();
  const decadeCounted = new Set<string>();
  for (const f of films) {
    if (f.rating !== null && f.year && !decadeCounted.has(f.film_slug)) {
      decadeCounted.add(f.film_slug);
      const decade = Math.floor(f.year / 10) * 10;
      const agg = ratedByDecade.get(decade) ?? { total: 0, count: 0 };
      agg.total += f.rating;
      agg.count += 1;
      ratedByDecade.set(decade, agg);
    }
  }
  const favoriteDecades = [...ratedByDecade.entries()]
    .filter(([, agg]) => agg.count >= 3)
    .map(([decade, agg]) => ({ decade, avg: agg.total / agg.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  const byFilm = new Map<string, Candidate>();

  for (const f of films) {
    // Era is a hard filter — we have real year data for it.
    if (!inEra(f.year, filters.era)) continue;

    const seen = watchedSlugs.has(f.film_slug) && f.entry_type !== "watchlist";
    const isWatchlist = f.entry_type === "watchlist";

    // Respect the rewatch toggle.
    if (!filters.allowRewatches && seen && !isWatchlist) continue;
    if (!filters.allowRewatches && isWatchlist && watchedSlugs.has(f.film_slug)) continue;

    const existing = byFilm.get(f.film_slug);
    const cand: Candidate = existing ?? {
      slug: f.film_slug,
      title: f.title,
      year: f.year,
      score: 0,
      reasons: [],
      seen,
    };

    if (isWatchlist) {
      cand.score += 10;
      if (!cand.reasons.includes("On your watchlist")) cand.reasons.push("On your watchlist");
    }

    if (seen && filters.allowRewatches && f.rating !== null && f.rating >= 4) {
      cand.score += f.rating * 2;
      const reason = `You rated it ${f.rating}★ — a rewatch favorite`;
      if (!cand.reasons.includes(reason)) cand.reasons.push(reason);
    }

    if (f.year) {
      const decade = Math.floor(f.year / 10) * 10;
      const fav = favoriteDecades.find((d) => d.decade === decade);
      if (fav) {
        cand.score += 3;
        const reason = `You rate ${decade}s films highly (${fav.avg.toFixed(1)}★ avg)`;
        if (!cand.reasons.includes(reason)) cand.reasons.push(reason);
      }
    }

    // Recency: recently-added watchlist items get a small nudge.
    cand.score += 0.001 * new Date(f.created_at ?? 0).getTime() * 1e-12;

    byFilm.set(f.film_slug, cand);
  }

  const libraryCands = [...byFilm.values()].sort((a, b) => b.score - a.score);

  // Daily variety without throwing away quality.
  //
  // This used to rotate the whole score-sorted list by the day number, which
  // meant that with a large library the offset landed deep in the list and the
  // best-matching films were rotated past the cut on almost every day. Rotate
  // inside a pool of the strongest candidates instead: every night draws from
  // good picks, but not the same ones twice.
  const poolSize = Math.min(libraryCands.length, Math.max(max * 3, 24));
  const pool = libraryCands.slice(0, poolSize);
  const dayOffset = Math.floor(Date.now() / 86_400_000) % Math.max(pool.length, 1);
  const rotated = [
    ...pool.slice(dayOffset),
    ...pool.slice(0, dayOffset),
    ...libraryCands.slice(poolSize),
  ];

  // Blend in curated discovery picks (classics and acclaimed films the user
  // hasn't seen) so recommendations reach beyond the watchlist: roughly one
  // discovery pick for every two library picks.
  const discoverBase = discoverFrom === undefined ? films : discoverFrom;
  const discovery =
    discoverBase === null
      ? []
      : buildDiscoveryCandidates(discoverBase, filters, Math.max(4, Math.floor(max / 3)));
  const merged: Candidate[] = [];
  let li = 0;
  let di = 0;
  while (merged.length < max && (li < rotated.length || di < discovery.length)) {
    if (li < rotated.length) merged.push(rotated[li++]);
    if (li < rotated.length) merged.push(rotated[li++]);
    if (di < discovery.length) merged.push(discovery[di++]);
  }
  return merged.slice(0, max);
}

/**
 * Curated catalog picks the user hasn't seen, matching tonight's filters for
 * real (the catalog carries mood/intensity/runtime/language tags). Ranked by
 * how the user rates each decade in their own library.
 */
export function buildDiscoveryCandidates(
  films: FilmRow[],
  filters: TonightFilters,
  max = 12
): Candidate[] {
  const owned = new Set<string>();
  for (const f of films) {
    owned.add(f.title.toLowerCase());
    owned.add(f.film_slug);
  }

  const decadeAffinity = new Map<number, number>();
  for (const f of films) {
    if (f.rating !== null && f.year) {
      const decade = Math.floor(f.year / 10) * 10;
      decadeAffinity.set(decade, Math.max(decadeAffinity.get(decade) ?? 0, f.rating));
    }
  }

  const wantIntensity = INTENSITY_ORDER.indexOf(filters.intensity);
  const out: Candidate[] = [];

  for (const entry of CATALOG) {
    if (owned.has(entry.t.toLowerCase())) continue;
    const slug = deriveSlug(entry.t, entry.y);
    if (owned.has(slug) || owned.has(deriveSlug(entry.t))) continue;

    const moodHit =
      entry.m.includes(filters.mood) ||
      (filters.mood === "classic" && entry.y < 1985) ||
      (filters.mood === "date" && entry.m.includes("romance")) ||
      (filters.mood === "easy" && (entry.m.includes("comedy") || entry.m.includes("feelgood")));
    if (!moodHit) continue;

    if (Math.abs(INTENSITY_ORDER.indexOf(entry.i) - wantIntensity) > 1) continue;
    if (entry.r > RUNTIME_MAX[filters.runtimeCap]) continue;
    const lang = entry.l ?? "en";
    if (filters.language === "english" && lang !== "en") continue;
    if (filters.language === "foreign" && lang === "en") continue;
    if (!inEra(entry.y, filters.era)) continue;

    const decade = Math.floor(entry.y / 10) * 10;
    const affinity = decadeAffinity.get(decade) ?? 0;
    const exactMood = entry.m.includes(filters.mood) ? 2 : 0;
    out.push({
      slug,
      title: entry.t,
      year: entry.y,
      score: 6 + affinity + exactMood,
      reasons: [
        entry.y < 1980
          ? `A canonical ${decade}s classic you haven't logged`
          : `Acclaimed pick beyond your library${affinity >= 4 ? ` — you rate the ${decade}s highly` : ""}`,
      ],
      seen: false,
      discovery: true,
    });
  }

  out.sort((a, b) => b.score - a.score);
  // Rotate within the strongest slice only — rotating the whole list pushed
  // the best matches past the cut on most days.
  const poolSize = Math.min(out.length, Math.max(max * 3, 18));
  const pool = out.slice(0, poolSize);
  const dayOffset = Math.floor(Date.now() / 86_400_000) % Math.max(pool.length, 1);
  return [...pool.slice(dayOffset), ...pool.slice(0, dayOffset)].slice(0, max);
}

// TMDB genre ids that satisfy each mood.
export const MOOD_GENRES: Record<TonightFilters["mood"], number[]> = {
  comedy: [35],
  date: [10749, 35],
  thriller: [53, 9648, 80],
  horror: [27],
  action: [28, 12],
  romance: [10749],
  weird: [14, 878],
  mindbender: [878, 9648],
  feelgood: [35, 10751, 16, 10402],
  tearjerker: [18],
  classic: [],
  easy: [35, 10751, 12, 16],
};

/**
 * How much you over- or under-rate each genre, versus your own average.
 *
 * Built from the films you've already rated, using whatever metadata the
 * cache has. Returns a delta in stars per genre id: +0.6 means films in that
 * genre average 0.6★ above your personal baseline. Genres with too few rated
 * films are dropped — three films is noise, not taste.
 *
 * This is the signal that was missing entirely: the engine knew which decades
 * you rate highly but nothing about whether you actually like horror.
 */
export function genreAffinity(
  films: FilmRow[],
  meta: Map<string, { genres: number[] }>
): Map<number, number> {
  const seen = new Set<string>();
  const totals = new Map<number, { sum: number; count: number }>();
  let overallSum = 0;
  let overallCount = 0;

  for (const f of films) {
    if (f.rating === null || f.entry_type === "watchlist") continue;
    if (seen.has(f.film_slug)) continue;
    seen.add(f.film_slug);
    overallSum += f.rating;
    overallCount += 1;

    for (const g of meta.get(f.film_slug)?.genres ?? []) {
      const agg = totals.get(g) ?? { sum: 0, count: 0 };
      agg.sum += f.rating;
      agg.count += 1;
      totals.set(g, agg);
    }
  }

  const affinity = new Map<number, number>();
  if (overallCount < 20) return affinity; // too little history to model taste
  const baseline = overallSum / overallCount;

  for (const [genre, agg] of totals) {
    if (agg.count < 5) continue;
    // Shrink toward zero for thin samples so a lucky run of four 5★ westerns
    // doesn't outrank a genre with sixty rated films behind it.
    const confidence = Math.min(1, agg.count / 25);
    affinity.set(genre, (agg.sum / agg.count - baseline) * confidence);
  }
  return affinity;
}

export interface CandidateMeta {
  runtime: number | null;
  genres: number[];
  language: string | null;
  vote: number | null;
}

/**
 * Second pass over candidates once real metadata is known: hard-filter
 * runtime and language (with a starvation guard), score genuine genre
 * matches and acclaim, and attach display metadata for the UI and AI.
 */
export function refineCandidates(
  candidates: Candidate[],
  filters: TonightFilters,
  meta: Map<string, CandidateMeta>,
  genreNames: Record<number, string>,
  affinity?: Map<number, number>
): Candidate[] {
  if (meta.size === 0) return candidates;
  const runtimeMax = RUNTIME_MAX[filters.runtimeCap];
  const wantGenres = new Set(MOOD_GENRES[filters.mood]);

  const passes = (c: Candidate) => {
    const m = meta.get(c.slug);
    if (!m) return true; // unknown metadata never disqualifies
    if (m.runtime && m.runtime > runtimeMax + 10) return false;
    if (filters.language === "english" && m.language && m.language !== "en") return false;
    if (filters.language === "foreign" && m.language === "en") return false;
    return true;
  };

  let refined = candidates.filter(passes);
  if (refined.length < Math.min(8, candidates.length)) refined = candidates; // never starve

  for (const c of refined) {
    const m = meta.get(c.slug);
    if (!m) continue;
    c.runtime = m.runtime;
    c.vote = m.vote;
    c.genreNames = m.genres.map((g) => genreNames[g]).filter(Boolean).slice(0, 3);

    if (wantGenres.size > 0 && m.genres.some((g) => wantGenres.has(g))) {
      c.score += 4;
      const genreLabel = c.genreNames[0] ?? "genre";
      const reason = `A genuine ${genreLabel.toLowerCase()} pick`;
      if (!c.reasons.includes(reason)) c.reasons.unshift(reason);
    }
    if (m.vote !== null && m.vote >= 7.5) {
      c.score += 2;
      const reason = `Rated ${m.vote} on TMDB`;
      if (!c.reasons.includes(reason)) c.reasons.push(reason);
    }

    // Personal genre taste: how you rate this film's genres against your own
    // baseline. Worth up to a few points either way, so a genre you reliably
    // love outranks a generically acclaimed film you'd shrug at.
    if (affinity && affinity.size > 0 && m.genres.length > 0) {
      const deltas = m.genres
        .map((g) => affinity.get(g))
        .filter((d): d is number => d !== undefined);
      if (deltas.length > 0) {
        const best = Math.max(...deltas);
        const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
        c.score += mean * 4;
        if (best >= 0.25) {
          const bestGenre = m.genres.find((g) => affinity.get(g) === best);
          const label = bestGenre !== undefined ? genreNames[bestGenre] : null;
          if (label) {
            const reason = `You rate ${label.toLowerCase()} above your own average`;
            if (!c.reasons.includes(reason)) c.reasons.push(reason);
          }
        }
      }
    }
    if (m.runtime && filters.runtimeCap !== "any" && m.runtime <= runtimeMax) {
      c.score += 1;
    }
  }

  return refined.sort((a, b) => b.score - a.score);
}

/**
 * Guarantee discovery survives a score sort.
 *
 * Watchlist films carry a flat bonus, so on a big watchlist they sweep the
 * whole top of the list and nothing new ever surfaces. This interleaves the
 * two groups — score order preserved inside each — so roughly one pick in
 * three is something outside the library, while the watchlist still leads.
 */
export function ensureDiscoveryMix(candidates: Candidate[], everyNth = 3): Candidate[] {
  const library = candidates.filter((c) => !c.discovery);
  const discovery = candidates.filter((c) => c.discovery);
  if (library.length === 0 || discovery.length === 0) return candidates;

  const out: Candidate[] = [];
  let li = 0;
  let di = 0;
  while (li < library.length || di < discovery.length) {
    if (di < discovery.length && out.length > 0 && (out.length + 1) % everyNth === 0) {
      out.push(discovery[di++]);
    } else if (li < library.length) {
      out.push(library[li++]);
    } else {
      out.push(discovery[di++]);
    }
  }
  return out;
}

/** Template "why" copy used when AI is skipped, rate-limited, or errors. */
export function deterministicPicks(
  candidates: Candidate[],
  filters: TonightFilters,
  count: number
): Pick[] {
  return candidates.slice(0, count).map((c) => {
    const detail = [c.genreNames?.[0], c.runtime ? `${c.runtime} min` : null]
      .filter(Boolean)
      .join(" · ");
    const base =
      c.reasons.length > 0
        ? `${c.reasons.slice(0, 2).join(". ")}. Fits ${MOOD_LABEL[filters.mood]}.`
        : `From your library — a solid fit for ${MOOD_LABEL[filters.mood]}.`;
    return {
      title: c.title,
      year: c.year,
      slug: c.slug,
      discovery: c.discovery,
      why: detail ? `${base} (${detail})` : base,
    };
  });
}

/**
 * Compare mode: blend candidates across up to 3 profiles, prioritizing films
 * that appear in multiple libraries (fairness before individual score).
 */
export function blendGroupCandidates(
  perProfile: { profileName: string; candidates: Candidate[] }[]
): Candidate[] {
  const merged = new Map<string, Candidate & { profiles: Set<string> }>();

  for (const { profileName, candidates } of perProfile) {
    for (const c of candidates) {
      const existing = merged.get(c.slug);
      if (existing) {
        existing.score += c.score;
        existing.profiles.add(profileName);
        for (const r of c.reasons) {
          if (!existing.reasons.includes(r)) existing.reasons.push(r);
        }
      } else {
        merged.set(c.slug, { ...c, reasons: [...c.reasons], profiles: new Set([profileName]) });
      }
    }
  }

  return [...merged.values()]
    .map((c) => {
      if (c.profiles.size > 1) {
        c.score += c.profiles.size * 25; // overlap dominates
        c.reasons.unshift(
          c.discovery
            ? "New to everyone — a fresh compromise"
            : `In ${c.profiles.size} of your libraries — an easy compromise`
        );
      }
      const { profiles: _profiles, ...rest } = c;
      return rest;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}
