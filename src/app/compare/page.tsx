import { redirect } from "next/navigation";

import { CompareClient } from "@/components/CompareClient";
import { computeOverlap, type OverlapStats } from "@/lib/compareStats";
import { getFilmsForProfile } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { session?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, letterboxd_username")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/setup");

  const admin = createAdminClient();
  const sessionId = searchParams.session;

  let activeSession: { id: string; joinCode: string; isOwner: boolean } | null = null;
  let overlap: OverlapStats | null = null;

  if (sessionId) {
    const { data: session } = await admin
      .from("sessions")
      .select("id, join_code, owner_user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (session) {
      const { data: members } = await admin
        .from("session_profiles")
        .select("profile_id, profiles!inner(id, letterboxd_username, is_guest)")
        .eq("session_id", session.id);

      const memberList = (members ?? []).map((m) => {
        const p = m.profiles as unknown as {
          id: string;
          letterboxd_username: string;
          is_guest: boolean;
        };
        return p;
      });

      const isMember =
        session.owner_user_id === user.id || memberList.some((m) => m.id === profile.id);

      if (isMember) {
        activeSession = {
          id: session.id,
          joinCode: session.join_code,
          isOwner: session.owner_user_id === user.id,
        };
        const libraries = await Promise.all(
          memberList.slice(0, 3).map(async (m) => ({
            profileId: m.id,
            username: m.letterboxd_username,
            isGuest: m.is_guest,
            films: await getFilmsForProfile(m.id),
          }))
        );
        overlap = computeOverlap(libraries);
      }
    }
  }

  return (
    <CompareClient
      username={profile.letterboxd_username}
      activeSession={activeSession}
      overlap={overlap}
    />
  );
}
