import { redirect } from "next/navigation";

import { MatchClient } from "@/components/MatchClient";
import { createClient } from "@/lib/supabase/server";

export default async function MatchPage() {
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

  return <MatchClient />;
}
