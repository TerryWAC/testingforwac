import { redirect } from "next/navigation";

import { GauntletClient } from "@/components/GauntletClient";
import { createClient } from "@/lib/supabase/server";

export default async function GauntletPage() {
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

  return <GauntletClient />;
}
