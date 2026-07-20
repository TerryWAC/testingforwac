import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_SESSION_PROFILES = 3;

/**
 * Shareable invite link: /join/ABC123 drops a logged-in friend straight
 * into the compare session. Logged-out visitors go to login first.
 */
export default async function JoinPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) redirect("/compare");

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

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("id")
    .eq("join_code", code)
    .maybeSingle();
  if (!session) redirect("/compare");

  const { data: already } = await admin
    .from("session_profiles")
    .select("profile_id")
    .eq("session_id", session.id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!already) {
    const { count } = await admin
      .from("session_profiles")
      .select("*", { count: "exact", head: true })
      .eq("session_id", session.id);
    if ((count ?? 0) < MAX_SESSION_PROFILES) {
      await admin
        .from("session_profiles")
        .insert({ session_id: session.id, profile_id: profile.id });
    }
  }

  redirect(`/compare?session=${session.id}`);
}
