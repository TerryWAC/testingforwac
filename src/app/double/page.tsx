import { redirect } from "next/navigation";

import { DoubleClient } from "@/components/DoubleClient";
import { getFilmsForProfile } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export default async function DoublePage() {
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
  const seenTitles = [
    ...new Set(
      films
        .filter((f) => f.entry_type !== "watchlist")
        .map((f) => f.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
    ),
  ];

  return <DoubleClient seenTitles={seenTitles} />;
}
