import { NextResponse } from "next/server";

import { syncProfileFromRss } from "@/lib/db";
import { guestProfileSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { LETTERBOXD_RSS_URL } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SESSION_PROFILES = 3;

/**
 * POST /api/sessions/guest — add an RSS-only "public compare" profile to a
 * session the caller owns. Recent-only data: whatever the public feed exposes.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = guestProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { sessionId, username } = parsed.data;

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("id, owner_user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Only the session owner can add guests" }, { status: 403 });
  }

  const { count } = await admin
    .from("session_profiles")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if ((count ?? 0) >= MAX_SESSION_PROFILES) {
    return NextResponse.json({ error: "Session is full (max 3 profiles)" }, { status: 400 });
  }

  try {
    const rssUrl = LETTERBOXD_RSS_URL(username);
    const { data: guest, error } = await admin
      .from("profiles")
      .insert({ letterboxd_username: username, rss_url: rssUrl, is_guest: true })
      .select("id, rss_url")
      .single();
    if (error || !guest) throw new Error(error?.message ?? "Could not create guest profile");

    // Pull whatever the public feed exposes (recent-only by nature).
    const { added } = await syncProfileFromRss(guest);

    await admin
      .from("session_profiles")
      .insert({ session_id: sessionId, profile_id: guest.id });

    return NextResponse.json({ profileId: guest.id, filmsImported: added });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not add guest" },
      { status: 400 }
    );
  }
}
