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

  // Taste signals from rated films.
  const ratedByDecade = new Map<number, { total: number; count: number }>();
  for (const f of films) {
    if (f.rating !== null && f.year) {
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

  // Stable shuffle-ish variety: rotate by day so "Recommend" isn't identical
  // every night while staying deterministic within a day.
  const dayOffset = Math.floor(Date.now() / 86_400_000) % Math.max(libraryCands.length, 1);
  const rotated = [...libraryCands.slice(dayOffset), ...libraryCands.slice(0, dayOffset)];

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
  const dayOffset = Math.floor(Date.now() / 86_400_000) % Math.max(out.length, 1);
  return [...out.slice(dayOffset), ...out.slice(0, dayOffset)].slice(0, max);
}

/** Template "why" copy used when AI is skipped, rate-limited, or errors. */
export function deterministicPicks(
  candidates: Candidate[],
  filters: TonightFilters,
  count: number
): Pick[] {
  return candidates.slice(0, count).map((c) => ({
    title: c.title,
    year: c.year,
    slug: c.slug,
    discovery: c.discovery,
    why:
      c.reasons.length > 0
        ? `${c.reasons.slice(0, 2).join(". ")}. Fits ${MOOD_LABEL[filters.mood]}.`
        : `From your library — a solid fit for ${MOOD_LABEL[filters.mood]}.`,
  }));
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
