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

  return (
    <DashboardClient
      username={profile.letterboxd_username}
      snapshot={snapshot}
      lastSyncedAt={profile.last_synced_at}
      syncStale={isSyncStale(profile.last_synced_at)}
    />
  );
}
