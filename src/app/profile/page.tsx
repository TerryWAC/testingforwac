import { redirect } from "next/navigation";

import { ProfileClient, type Badge, type FriendSummary } from "@/components/ProfileClient";
import { getFilmsForProfile, syncProfileFromRss } from "@/lib/db";
import { computeSnapshot, longestStreak, movieBuffProfile } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, letterboxd_username, last_synced_at, created_at, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/setup");

  const films = await getFilmsForProfile(profile.id, { withReviews: true });
  const snapshot = computeSnapshot(films);

  const reviews = films
    .filter((f) => f.review)
    .sort((a, b) => ((b.watched_date ?? "") < (a.watched_date ?? "") ? -1 : 1))
    .slice(0, 20)
    .map((f) => ({
      slug: f.film_slug,
      title: f.title,
      year: f.year,
      rating: f.rating,
      watched_date: f.watched_date,
      review: f.review as string,
    }));

  // Achievements.
  const watched = films.filter((f) => f.entry_type !== "watchlist");
  const decadesExplored = new Set(
    watched.filter((f) => f.year).map((f) => Math.floor((f.year as number) / 10) * 10)
  ).size;
  const streak = longestStreak(
    watched.filter((f) => f.watched_date).map((f) => f.watched_date as string)
  );
  const reviewCount = films.filter((f) => f.review).length;
  const badges: Badge[] = [
    { id: "first", label: "First Steps", desc: "Log your first film", earned: snapshot.totalFilms >= 1 },
    { id: "c100", label: "Century Club", desc: "Watch 100 films", earned: snapshot.totalFilms >= 100 },
    { id: "c250", label: "Cinephile", desc: "Watch 250 films", earned: snapshot.totalFilms >= 250 },
    { id: "c500", label: "Obsessed", desc: "Watch 500 films", earned: snapshot.totalFilms >= 500 },
    { id: "c1000", label: "The Archivist", desc: "Watch 1,000 films", earned: snapshot.totalFilms >= 1000 },
    { id: "critic", label: "The Critic", desc: "Rate 100 films", earned: snapshot.totalRated >= 100 },
    { id: "time", label: "Time Traveler", desc: "Watch films from 7+ decades", earned: decadesExplored >= 7 },
    { id: "words", label: "Wordsmith", desc: "Write 10 reviews", earned: reviewCount >= 10 },
    { id: "dream", label: "The Dreamer", desc: "50 films on your watchlist", earned: snapshot.watchlistCount >= 50 },
    { id: "roll", label: "On a Roll", desc: "Watch films 7 days in a row", earned: streak >= 7 },
  ];

  // Friends and their public snapshots.
  const admin = createAdminClient();
  const { data: friendRows } = await admin
    .from("friends")
    .select("id, profile_id, profiles!inner(letterboxd_username, last_synced_at, avatar_url, rss_url)")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  // Friend libraries grow over time: their public feed only shows recent
  // activity, so re-sync stale feeds on every visit to accumulate history.
  const STALE_MS = 12 * 3600 * 1000;
  await Promise.all(
    (friendRows ?? []).slice(0, 8).map(async (row) => {
      const p = row.profiles as unknown as { last_synced_at: string | null; rss_url: string };
      const stale =
        !p.last_synced_at || Date.now() - new Date(p.last_synced_at).getTime() > STALE_MS;
      if (stale) {
        try {
          await syncProfileFromRss({ id: row.profile_id, rss_url: p.rss_url });
        } catch {}
      }
    })
  );

  const friends: FriendSummary[] = await Promise.all(
    (friendRows ?? []).map(async (row) => {
      const p = row.profiles as unknown as {
        letterboxd_username: string;
        last_synced_at: string | null;
        avatar_url: string | null;
      };
      const friendFilms = await getFilmsForProfile(row.profile_id);
      const friendSnapshot = computeSnapshot(friendFilms);
      const friendBuff = movieBuffProfile(friendFilms);
      return {
        id: row.id,
        username: p.letterboxd_username,
        avatarUrl: p.avatar_url,
        filmCount: friendSnapshot.totalFilms,
        recentWatches: friendSnapshot.recentWatches.slice(0, 3),
        topRated: friendSnapshot.topRated.slice(0, 3),
        build: { level: friendBuff.level, title: friendBuff.title, tier: friendBuff.tier },
      };
    })
  );

  return (
    <ProfileClient
      username={profile.letterboxd_username}
      avatarUrl={profile.avatar_url}
      memberSince={profile.created_at}
      lastSyncedAt={profile.last_synced_at}
      snapshot={snapshot}
      friends={friends}
      reviews={reviews}
      badges={badges}
    />
  );
}
