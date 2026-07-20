import { redirect } from "next/navigation";

import { PeopleClient } from "@/components/PeopleClient";
import { getFilmsForProfile } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export default async function PeoplePage() {
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

  // Normalized titles for marking a filmography as seen/watchlisted.
  const films = await getFilmsForProfile(profile.id);
  const seenTitles: string[] = [];
  const watchlistTitles: string[] = [];
  for (const f of films) {
    const t = f.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (f.entry_type === "watchlist") watchlistTitles.push(t);
    else seenTitles.push(t);
  }

  return (
    <PeopleClient seenTitles={[...new Set(seenTitles)]} watchlistTitles={[...new Set(watchlistTitles)]} />
  );
}
