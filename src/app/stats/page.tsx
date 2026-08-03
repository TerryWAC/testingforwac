import { redirect } from "next/navigation";

import { StatsClient } from "@/components/StatsClient";
import { getFilmsForProfile } from "@/lib/db";
import { longestStreak, movieBuffProfile, uniqueViewings } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export default async function StatsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/setup");

  const films = await getFilmsForProfile(profile.id);
  // One watch can be stored twice (export ZIP as 'diary', RSS sync as 'rss'),
  // which would darken heatmap cells for days you only watched one film.
  const watched = uniqueViewings(films.filter((f) => f.entry_type !== "watchlist"));

  // Daily counts for the last ~26 weeks, aligned so columns start on Monday.
  const counts = new Map<string, number>();
  for (const f of watched) {
    if (f.watched_date) counts.set(f.watched_date, (counts.get(f.watched_date) ?? 0) + 1);
  }
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 181 - ((today.getDay() + 6) % 7));
  const heatmap: { date: string; count: number }[] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    heatmap.push({ date: iso, count: counts.get(iso) ?? 0 });
  }

  // Rating histogram (0.5★ buckets) over unique films' best rating.
  const bestRating = new Map<string, number>();
  for (const f of watched) {
    if (f.rating !== null) {
      bestRating.set(f.film_slug, Math.max(bestRating.get(f.film_slug) ?? 0, f.rating));
    }
  }
  const histogram = Array.from({ length: 10 }, () => 0);
  for (const r of bestRating.values()) {
    const idx = Math.min(9, Math.max(0, Math.round(r * 2) - 1));
    histogram[idx]++;
  }

  // Films per decade (unique).
  const decadeSeen = new Map<number, Set<string>>();
  for (const f of watched) {
    if (f.year) {
      const dec = Math.floor(f.year / 10) * 10;
      if (!decadeSeen.has(dec)) decadeSeen.set(dec, new Set());
      decadeSeen.get(dec)!.add(f.film_slug);
    }
  }
  const decades = [...decadeSeen.entries()]
    .map(([decade, set]) => ({ decade: `${decade}s`, count: set.size }))
    .sort((a, b) => a.decade.localeCompare(b.decade));

  const streak = longestStreak(
    watched.filter((f) => f.watched_date).map((f) => f.watched_date as string)
  );

  return (
    <StatsClient
      heatmap={heatmap}
      histogram={histogram}
      decades={decades}
      streak={streak}
      buff={movieBuffProfile(films)}
    />
  );
}
