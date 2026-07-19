import { redirect } from "next/navigation";

import { ProfileClient, type FriendSummary } from "@/components/ProfileClient";
import { getFilmsForProfile } from "@/lib/db";
import { computeSnapshot } from "@/lib/stats";
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

  const films = await getFilmsForProfile(profile.id);
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

  // Friends and their public snapshots.
  const admin = createAdminClient();
  const { data: friendRows } = await admin
    .from("friends")
    .select("id, profile_id, profiles!inner(letterboxd_username, last_synced_at, avatar_url)")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  const friends: FriendSummary[] = await Promise.all(
    (friendRows ?? []).map(async (row) => {
      const p = row.profiles as unknown as {
        letterboxd_username: string;
        last_synced_at: string | null;
        avatar_url: string | null;
      };
      const friendFilms = await getFilmsForProfile(row.profile_id);
      const friendSnapshot = computeSnapshot(friendFilms);
      return {
        id: row.id,
        username: p.letterboxd_username,
        avatarUrl: p.avatar_url,
        filmCount: friendSnapshot.totalFilms,
        recentWatches: friendSnapshot.recentWatches.slice(0, 3),
        topRated: friendSnapshot.topRated.slice(0, 3),
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
    />
  );
}
