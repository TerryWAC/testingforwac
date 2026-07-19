import type { FilmRow, TasteSnapshot } from "@/lib/types";

/** Compute the taste snapshot on the fly from stored film rows. */
export function computeSnapshot(films: FilmRow[]): TasteSnapshot {
  const watched = films.filter((f) => f.entry_type !== "watchlist");
  const rated = watched.filter((f) => f.rating !== null);
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

  const averageRating =
    rated.length > 0
      ? Math.round((rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length) * 100) / 100
      : null;

  return {
    totalFilms: uniqueWatched.size,
    totalRated: rated.length,
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
