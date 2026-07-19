import type { FilmRow, Pick, TonightFilters } from "@/lib/types";

export interface Candidate {
  slug: string;
  title: string;
  year: number | null;
  score: number;
  reasons: string[];
  seen: boolean;
}

const MOOD_LABEL: Record<TonightFilters["mood"], string> = {
  comedy: "a comedy night",
  date: "date night",
  thriller: "a thriller night",
  weird: "something weird",
  easy: "an easy watch",
};

/**
 * Stage 1 — deterministic candidate builder. Free, instant, and the fallback
 * whenever AI is unavailable. Works purely from the user's own stored library
 * (watchlist + watch history); we deliberately have no external film catalog.
 */
export function buildCandidates(
  films: FilmRow[],
  filters: TonightFilters,
  max = 20
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

  const candidates = [...byFilm.values()].sort((a, b) => b.score - a.score).slice(0, max);

  // Stable shuffle-ish variety: rotate by day so "Recommend" isn't identical
  // every night while staying deterministic within a day.
  const dayOffset = Math.floor(Date.now() / 86_400_000) % Math.max(candidates.length, 1);
  return [...candidates.slice(dayOffset), ...candidates.slice(0, dayOffset)];
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
        c.reasons.unshift(`In ${c.profiles.size} of your libraries — an easy compromise`);
      }
      const { profiles: _profiles, ...rest } = c;
      return rest;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}
