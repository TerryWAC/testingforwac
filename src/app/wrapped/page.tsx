import { redirect } from "next/navigation";

import { WrappedClient } from "@/components/WrappedClient";
import { getFilmsForProfile } from "@/lib/db";
import { longestStreak } from "@/lib/stats";
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
  const dated = films.filter((f) => f.entry_type !== "watchlist" && f.watched_date);

  const years = [...new Set(dated.map((f) => Number(f.watched_date!.slice(0, 4))))].sort(
    (a, b) => b - a
  );
  const currentYear = new Date().getFullYear();
  const year = Number(searchParams.year) || years[0] || currentYear;

  const inYear = dated.filter((f) => f.watched_date!.startsWith(String(year)));
  const monthCounts = Array.from({ length: 12 }, () => 0);
  for (const f of inYear) monthCounts[Number(f.watched_date!.slice(5, 7)) - 1]++;

  const rated = inYear.filter((f) => f.rating !== null);
  const avgRating =
    rated.length > 0
      ? Math.round((rated.reduce((s, f) => s + f.rating!, 0) / rated.length) * 100) / 100
      : null;

  const decadeCounts = new Map<string, number>();
  for (const f of inYear) {
    if (f.year) {
      const d = `${Math.floor(f.year / 10) * 10}s`;
      decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1);
    }
  }
  const topDecade = [...decadeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topRated = [...inYear]
    .filter((f) => f.rating !== null)
    .sort((a, b) => b.rating! - a.rating!)
    .slice(0, 5)
    .map((f) => ({ slug: f.film_slug, title: f.title, year: f.year, rating: f.rating! }));

  const sorted = [...inYear].sort((a, b) => (a.watched_date! < b.watched_date! ? -1 : 1));
  const firstFilm = sorted[0] ? { title: sorted[0].title, date: sorted[0].watched_date! } : null;
  const lastFilm = sorted.at(-1)
    ? { title: sorted.at(-1)!.title, date: sorted.at(-1)!.watched_date! }
    : null;

  const streak = longestStreak(inYear.map((f) => f.watched_date!));
  const busiestMonthIdx = monthCounts.indexOf(Math.max(...monthCounts));

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
      busiestMonth={
        monthCounts[busiestMonthIdx] > 0
          ? new Date(year, busiestMonthIdx, 1).toLocaleDateString(undefined, { month: "long" })
          : null
      }
    />
  );
}
