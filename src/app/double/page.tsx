import { redirect } from "next/navigation";

import { DoubleClient } from "@/components/DoubleClient";
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

  return <DoubleClient />;
}
