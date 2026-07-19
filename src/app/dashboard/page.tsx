import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/DashboardClient";
import { getFilmsForProfile, isSyncStale } from "@/lib/db";
import { computeSnapshot } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, letterboxd_username, rss_url, last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/setup");

  const films = await getFilmsForProfile(profile.id);
  const snapshot = computeSnapshot(films);

  // "On this day" — watches from this calendar date in earlier years.
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const memories = films
    .filter((f) => {
      if (!f.watched_date) return false;
      const [y, m, d] = f.watched_date.split("-").map(Number);
      return m === month && d === day && y < now.getFullYear();
    })
    .map((f) => {
      const watchedYear = Number(f.watched_date!.slice(0, 4));
      return {
        slug: f.film_slug,
        title: f.title,
        year: f.year,
        watchedYear,
        yearsAgo: now.getFullYear() - watchedYear,
      };
    })
    .sort((a, b) => a.yearsAgo - b.yearsAgo);

  return (
    <DashboardClient
      username={profile.letterboxd_username}
      snapshot={snapshot}
      lastSyncedAt={profile.last_synced_at}
      syncStale={isSyncStale(profile.last_synced_at)}
      memories={memories}
    />
  );
}
