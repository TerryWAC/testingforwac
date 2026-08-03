import { redirect } from "next/navigation";

import { WrappedClient } from "@/components/WrappedClient";
import { getFilmsForProfile } from "@/lib/db";
import { getFilmMeta } from "@/lib/filmMeta";
import { bestRatingBySlug, longestStreak, uniqueViewings } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export default async function WrappedPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, letterboxd_username")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/setup");

  const films = await getFilmsForProfile(profile.id);
  // One watch can be stored twice (export ZIP as 'diary', RSS sync as 'rss').
  const dated = uniqueViewings(
    films.filter((f) => f.entry_type !== "watchlist" && f.watched_date)
  );

  const years = [...new Set(dated.map((f) => Number(f.watched_date!.slice(0, 4))))].sort(
    (a, b) => b - a
  );
  const currentYear = new Date().getFullYear();
  const year = Number(searchParams.year) || years[0] || currentYear;

  const inYear = dated.filter((f) => f.watched_date!.startsWith(String(year)));
  const monthCounts = Array.from({ length: 12 }, () => 0);
  for (const f of inYear) monthCounts[Number(f.watched_date!.slice(5, 7)) - 1]++;

  // Per distinct film, so a rewatch doesn't weight the average twice.
  const ratedBySlug = bestRatingBySlug(inYear);
  const ratings = [...ratedBySlug.values()];
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100
      : null;

  const decadeCounts = new Map<string, number>();
  for (const f of inYear) {
    if (f.year) {
      const d = `${Math.floor(f.year / 10) * 10}s`;
      decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1);
    }
  }
  const topDecade = [...decadeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Dedupe by slug: a film rewatched and rated twice in one year would
  // otherwise fill two slots in a five-item list.
  const topRatedSeen = new Set<string>();
  const topRated = [...inYear]
    .filter((f) => f.rating !== null)
    .sort((a, b) => b.rating! - a.rating!)
    .filter((f) => !topRatedSeen.has(f.film_slug) && topRatedSeen.add(f.film_slug))
    .slice(0, 5)
    .map((f) => ({ slug: f.film_slug, title: f.title, year: f.year, rating: f.rating! }));

  const sorted = [...inYear].sort((a, b) => (a.watched_date! < b.watched_date! ? -1 : 1));
  const firstFilm = sorted[0] ? { title: sorted[0].title, date: sorted[0].watched_date! } : null;
  const lastFilm = sorted.at(-1)
    ? { title: sorted.at(-1)!.title, date: sorted.at(-1)!.watched_date! }
    : null;

  const streak = longestStreak(inYear.map((f) => f.watched_date!));

  // "Films a week" for the year in progress has to divide by the weeks that
  // have actually happened — dividing by 52 in August understates the pace by
  // about 40%.
  const weeksElapsed =
    year === currentYear
      ? Math.max(1, Math.ceil((Date.now() - new Date(year, 0, 1).getTime()) / 604_800_000))
      : 52;
  const busiestMonthIdx = monthCounts.indexOf(Math.max(...monthCounts));

  // Total time in front of films: known runtimes from the metadata cache,
  // unknowns estimated at the year's own average (or 105 min).
  const uniqueYearFilms = new Map<string, { slug: string; title: string; year: number | null }>();
  for (const f of inYear) {
    uniqueYearFilms.set(f.film_slug, { slug: f.film_slug, title: f.title, year: f.year });
  }
  let minutesWatched = 0;
  let runtimeCoverage = 0;
  try {
    const metaMap = await getFilmMeta([...uniqueYearFilms.values()], 12);
    let knownMins = 0;
    for (const film of uniqueYearFilms.values()) {
      const rt = metaMap.get(film.slug)?.runtime;
      if (rt) {
        runtimeCoverage++;
        knownMins += rt;
      }
    }
    const avg = runtimeCoverage > 0 ? knownMins / runtimeCoverage : 105;
    minutesWatched = Math.round(knownMins + (uniqueYearFilms.size - runtimeCoverage) * avg);
  } catch {
    minutesWatched = uniqueYearFilms.size * 105;
  }

  return (
    <WrappedClient
      username={profile.letterboxd_username}
      year={year}
      years={years}
      total={new Set(inYear.map((f) => f.film_slug)).size}
      monthCounts={monthCounts}
      avgRating={avgRating}
      topDecade={topDecade}
      topRated={topRated}
      firstFilm={firstFilm}
      lastFilm={lastFilm}
      streak={streak}
      weeksElapsed={weeksElapsed}
      minutesWatched={minutesWatched}
      busiestMonth={
        monthCounts[busiestMonthIdx] > 0
          ? new Date(year, busiestMonthIdx, 1).toLocaleDateString(undefined, { month: "long" })
          : null
      }
    />
  );
}
