import { CATALOG } from "@/lib/catalog";
import type { FilmRow, Mood, TasteSnapshot } from "@/lib/types";

export interface BuffProfile {
  level: number;
  title: string;
  tier: "S" | "A" | "B" | "C" | "F";
  roast: string;
  strengths: string[];
  weaknesses: string[];
}

/**
 * The "Letterboxd build" analyzer — levels, archetypes, tier grades and a
 * roast, computed deterministically from the user's own library.
 */
export function movieBuffProfile(films: FilmRow[]): BuffProfile {
  // Your build describes a library, not a viewing log: a film rewatched five
  // times is still one film and shouldn't drag the decade mix or the average
  // rating five times as hard.
  const bySlug = new Map<string, FilmRow>();
  for (const f of films) {
    if (f.entry_type === "watchlist") continue;
    const existing = bySlug.get(f.film_slug);
    if (!existing || (existing.rating === null && f.rating !== null)) {
      bySlug.set(f.film_slug, f);
    }
  }
  const watched = [...bySlug.values()];
  const total = watched.length;
  const ratings = [...bestRatingBySlug(watched).values()];
  const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
  const watchlistCount = new Set(
    films.filter((f) => f.entry_type === "watchlist").map((f) => f.film_slug)
  ).size;
  const reviews = new Set(films.filter((f) => f.review).map((f) => f.film_slug)).size;

  const decadeCounts = new Map<number, number>();
  const dated = watched.filter((f) => f.year);
  for (const f of dated) {
    const d = Math.floor((f.year as number) / 10) * 10;
    decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1);
  }
  const pct = (from: number, to: number) =>
    dated.length === 0
      ? 0
      : [...decadeCounts.entries()]
          .filter(([d]) => d >= from && d < to)
          .reduce((s, [, c]) => s + c, 0) / dated.length;
  const preOld = pct(1900, 1980);
  const modern = pct(2010, 2100);
  const nineties = pct(1990, 2000);
  const spread = [...decadeCounts.values()].filter((c) => c >= Math.max(3, dated.length * 0.04))
    .length;

  // Mood signals: match library titles against the tagged catalog. Sparse
  // but honest — only kicks in with enough matches to mean something.
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ownedTitles = new Set(watched.map((f) => norm(f.title)));
  const moodCounts = new Map<Mood, number>();
  let matched = 0;
  for (const entry of CATALOG) {
    if (ownedTitles.has(norm(entry.t))) {
      matched++;
      for (const m of entry.m) moodCounts.set(m, (moodCounts.get(m) ?? 0) + 1);
    }
  }
  const moodShare = (...moods: Mood[]) =>
    matched === 0 ? 0 : moods.reduce((s, m) => s + (moodCounts.get(m) ?? 0), 0) / matched;
  const moodsKnown = matched >= 15;

  // Level: volume first, breadth bonus.
  const volumeLevel =
    total < 25 ? 1 : total < 50 ? 2 : total < 100 ? 3 : total < 200 ? 4 : total < 300 ? 5
    : total < 450 ? 6 : total < 650 ? 7 : total < 900 ? 8 : total < 1200 ? 9 : 10;
  const level = Math.min(10, volumeLevel + (spread >= 6 ? 1 : 0));

  const grade = (base: "S" | "A" | "B" | "C" | "F"): BuffProfile["tier"] => base;

  if (total < 30) {
    return {
      level,
      title: "Fresh Install",
      tier: grade("C"),
      roast: `Only ${total} films logged — you're still in the tutorial. Every build starts somewhere, but right now you're picking fights with film bros using starter gear.`,
      strengths: ["Nowhere to go but up", "No pretentious debt"],
      weaknesses: ["Extremely low film-history stat", "Vulnerable to literally every reference"],
    };
  }
  if (preOld >= 0.35) {
    return {
      level,
      title: "The Old Head",
      tier: grade(level >= 7 ? "S" : "A"),
      roast: `${Math.round(preOld * 100)}% of your library is pre-1980. You've dumped nearly every point into the film-history stat — devastating in cinephile duels, but hand you the remote at a party and the room empties.`,
      strengths: ["Massive film-history damage", "Immune to pretentious attacks", "Criterion aura"],
      weaknesses: ["Weak to 'is it in colour?'", "Low general-audience compatibility"],
    };
  }
  if (avg !== null && avg <= 2.9 && ratings.length > 50) {
    return {
      level,
      title: "The Hater",
      tier: grade("B"),
      roast: `A ${avg.toFixed(2)}★ average across ${ratings.length} ratings. You've min-maxed contrarian damage — nothing is ever good enough, and honestly, that's a build. Respect.`,
      strengths: ["Devastating takedown criticals", "Unshakeable standards"],
      weaknesses: ["Cannot experience joy", "-5 to movie-night invitations"],
    };
  }
  if (avg !== null && avg >= 4.2 && ratings.length > 50) {
    return {
      level,
      title: "The Enjoyer",
      tier: grade("B"),
      roast: `A ${avg.toFixed(2)}★ average — everything's a banger in your world. You've speced fully into the enjoyment stat and left crit-thinking at level 1. Genuinely the happiest build in the meta.`,
      strengths: ["Maximum joy uptime", "Immune to disappointment"],
      weaknesses: ["Ratings carry zero information", "Film snobs farm you for XP"],
    };
  }
  if (moodsKnown && moodShare("horror") >= 0.25) {
    return {
      level,
      title: "The Edgelord",
      tier: grade("B"),
      roast: `A quarter of your recognisable library is horror. You've min-maxed the disturbing-content stat — about as edgy as you can get without people thinking you're a weirdo. The Babadook walked so you could run.`,
      strengths: ["High disturbing-content resistance", "Halloween season MVP"],
      weaknesses: ["Weak against the easily spooked", "Date-night deployment is a gamble"],
    };
  }
  if (moodsKnown && moodShare("action") >= 0.3 && pct(1980, 2000) >= 0.3) {
    return {
      level,
      title: "The Dad Movie Build",
      tier: grade("A"),
      roast: `Heavy action loadout with a strong 80s-90s base. The dad movie build has always been one of the most overpowered strategies in the game — it doesn't matter who you are, this gets the job done in almost every situation.`,
      strengths: ["Works on literally any audience", "Explosion-based crowd control"],
      weaknesses: ["Film snobs farm you at long range", "Emotional-depth slot left empty"],
    };
  }
  if (moodsKnown && moodShare("romance", "date") >= 0.3) {
    return {
      level,
      title: "The Hopeless Romantic",
      tier: grade("A"),
      roast: `Nearly a third of your recognisable picks are romance-coded. You've built entirely around heart damage — devastating on date night, and honestly one of the most underrated builds in the meta. Mother is mothering.`,
      strengths: ["Date-night ultimate always charged", "+5 emotional intelligence aura"],
      weaknesses: ["Cynics resist your main attack", "Cries at trailers"],
    };
  }
  if (moodsKnown && moodShare("feelgood") >= 0.35) {
    return {
      level,
      title: "Childhood Nostalgia Build",
      tier: grade("C"),
      roast: `You've dumped a huge chunk of your points into the comfort-watch stat. It's the ultimate defensive build — immune to pretension, unbeatable with nieces and nephews — but step into a serious film lobby and you're fighting with a Paddington plushie.`,
      strengths: ["Immune to pretentious attacks", "Maximum cosiness uptime"],
      weaknesses: ["Limited endgame content", "'Have you seen anything sad?' hits critical"],
    };
  }
  if (pct(1960, 1990) >= 0.45) {
    return {
      level,
      title: "Boomer Nostalgia",
      tier: grade("C"),
      roast: `Almost half your library lives between the 60s and the 80s. You're one of the strongest nostalgia players in the game — but you've dumped everything into one era stat and it shows. Zero versatility, maximum vibes.`,
      strengths: ["Legendary-era item collection", "Unbeatable at pub quiz decades rounds"],
      weaknesses: ["Anything post-2000 is off the map", "One-stat wonder"],
    };
  }
  if (moodsKnown && moodShare("classic", "mindbender") >= 0.35 && avg !== null && avg >= 3.2 && avg <= 4.1) {
    return {
      level,
      title: "The Arthouse Nerd",
      tier: grade(level >= 6 ? "S" : "A"),
      roast: `A well-judged blend of canon classics and mind-benders, rated with actual discernment. This is the arthouse-nerd hybrid build — strong across the board, and so well-rounded it's almost unfair.`,
      strengths: ["High film-history AND modern coverage", "Deflects snob attacks with ease"],
      weaknesses: ["Occasionally unbearable at parties", "Long answer to 'seen anything good?'"],
    };
  }
  if (watchlistCount > total) {
    return {
      level,
      title: "The Dreamer",
      tier: grade("C"),
      roast: `${watchlistCount} on the watchlist versus ${total} actually watched. You're hoarding legendary items you never equip. The backlog isn't a personality — press play.`,
      strengths: ["Elite taste in intentions", "Infinite potential energy"],
      weaknesses: ["Watchlist-to-action conversion near zero", "Analysis paralysis debuff"],
    };
  }
  if (modern >= 0.65) {
    return {
      level,
      title: "The Hype Beast",
      tier: grade(level >= 6 ? "A" : "B"),
      roast: `${Math.round(modern * 100)}% of your library is from the 2010s onward. You're farming the new-release meta hard — great trend awareness, but your film-history tree is completely unspent.`,
      strengths: ["Always current", "High opening-weekend energy"],
      weaknesses: ["Anything pre-2000 is uncharted map", "Vulnerable to 'have you seen the original?'"],
    };
  }
  if (reviews >= 20) {
    return {
      level,
      title: "The Essayist",
      tier: grade("A"),
      roast: `${reviews} written reviews. You don't just watch films, you file reports on them. A high-effort support class — the group chat's designated critic.`,
      strengths: ["Articulate takedowns", "+3 to post-film discussions"],
      weaknesses: ["Cannot 'just enjoy it'", "Long cooldown between hot takes"],
    };
  }
  if (nineties >= 0.3) {
    return {
      level,
      title: "The Film Bro",
      tier: grade("B"),
      roast: `${Math.round(nineties * 100)}% of your library lives in the 1990s. The old reliable film bro build — quotable, crowd-pleasing, and yes, we know your top four probably has a Tarantino in it.`,
      strengths: ["High crowd-pleaser damage", "Quotable-dialogue buff always active"],
      weaknesses: ["Predictable loadout", "Weak to subtitle-based attacks"],
    };
  }
  if (spread >= 7) {
    return {
      level,
      title: "The Renaissance Watcher",
      tier: grade(level >= 7 ? "S" : "A"),
      roast: `Meaningful watch counts across ${spread} decades. A genuinely rare all-rounder build — no glaring weaknesses, dangerous in any movie-night lobby. This is what an endgame library looks like.`,
      strengths: ["No coverage gaps", "Adapts to any audience", "Resistant to snob AND casual attacks"],
      weaknesses: ["Jack of all decades", "Takes forever to pick a favourite"],
    };
  }
  return {
    level,
    title: "The Balanced Build",
    tier: grade(level >= 6 ? "A" : "B"),
    roast: `A solid, well-rounded library with no extreme stat dumps. You can hang in most film conversations and survive most movie nights — the dependable mid-meta build everyone underrates.`,
    strengths: ["Few exploitable weaknesses", "Reliable pick quality"],
    weaknesses: ["No signature move", "Occasionally out-flexed by specialists"],
  };
}

/** Longest run of consecutive days with at least one watch. */
export function longestStreak(dates: string[]): number {
  const unique = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of unique) {
    const t = new Date(`${d}T12:00:00`).getTime();
    run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/** Compute the taste snapshot on the fly from stored film rows. */
/**
 * Collapse rows that describe the same viewing.
 *
 * The films table is keyed on (profile, slug, date, entry_type), so one watch
 * can legitimately land twice — once from the export ZIP as 'diary' and again
 * from the RSS sync as 'rss'. Same film on the same day is one viewing, so
 * anything counting watches (month charts, heatmaps, averages) has to dedupe
 * first or it silently double-counts. Rewatches on different dates survive,
 * which is correct.
 */
export function uniqueViewings(films: FilmRow[]): FilmRow[] {
  const byViewing = new Map<string, FilmRow>();
  for (const f of films) {
    const key = `${f.film_slug}|${f.watched_date ?? ""}`;
    const existing = byViewing.get(key);
    // Prefer the copy carrying a rating, then the one carrying a review.
    if (
      !existing ||
      (existing.rating === null && f.rating !== null) ||
      (!existing.review && f.review)
    ) {
      byViewing.set(key, f);
    }
  }
  return [...byViewing.values()];
}

/** Each film's highest rating across rewatches, keyed by slug. */
export function bestRatingBySlug(films: FilmRow[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const f of films) {
    if (f.rating !== null) {
      best.set(f.film_slug, Math.max(best.get(f.film_slug) ?? 0, f.rating));
    }
  }
  return best;
}

export function computeSnapshot(films: FilmRow[]): TasteSnapshot {
  const watched = uniqueViewings(films.filter((f) => f.entry_type !== "watchlist"));
  const ratedBySlug = bestRatingBySlug(watched);
  const uniqueRated = ratedBySlug.size;
  const watchlist = films.filter((f) => f.entry_type === "watchlist");

  // Dedupe by slug for counts (a rewatch is still one film).
  const uniqueWatched = new Map<string, FilmRow>();
  for (const f of watched) {
    const existing = uniqueWatched.get(f.film_slug);
    if (!existing || (existing.rating === null && f.rating !== null)) {
      uniqueWatched.set(f.film_slug, f);
    }
  }

  const decadeCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  for (const f of uniqueWatched.values()) {
    if (f.year) {
      const decade = `${Math.floor(f.year / 10) * 10}s`;
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
      yearCounts.set(f.year, (yearCounts.get(f.year) ?? 0) + 1);
    }
  }

  const topDecades = [...decadeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([decade, count]) => ({ decade, count }));

  const mostWatchedYearEntry = [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const topRated = [...uniqueWatched.values()]
    .filter((f): f is FilmRow & { rating: number } => f.rating !== null)
    .sort((a, b) => b.rating - a.rating || (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 20)
    .map((f) => ({ title: f.title, year: f.year, slug: f.film_slug, rating: f.rating }));

  const recentWatches = watched
    .filter((f) => f.watched_date)
    .sort((a, b) => (b.watched_date! < a.watched_date! ? -1 : 1))
    .slice(0, 20)
    .map((f) => ({ title: f.title, year: f.year, slug: f.film_slug, watched_date: f.watched_date }));

  // Averaged over distinct films, not rows: otherwise a film you rewatched
  // three times pulls the average three times as hard, and the number stops
  // matching the "Rated N" count sitting next to it.
  const ratings = [...ratedBySlug.values()];
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 100) / 100
      : null;

  return {
    totalFilms: uniqueWatched.size,
    totalRated: uniqueRated,
    averageRating,
    topDecades,
    topRated,
    recentWatches,
    mostWatchedYear: mostWatchedYearEntry
      ? { year: mostWatchedYearEntry[0], count: mostWatchedYearEntry[1] }
      : null,
    watchlistCount: new Set(watchlist.map((f) => f.film_slug)).size,
  };
}
