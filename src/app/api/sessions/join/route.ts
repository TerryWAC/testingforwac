import { NextResponse } from "next/server";

import { joinSessionSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_SESSION_PROFILES = 3;

/**
 * POST /api/sessions/join — join a session via its short code. Joining via
 * code is the only way another user's library becomes visible to the group.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = joinSessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Set up your profile first" }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("id")
    .eq("join_code", parsed.data.joinCode)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { count } = await admin
    .from("session_profiles")
    .select("*", { count: "exact", head: true })
    .eq("session_id", session.id);

  const { data: already } = await admin
    .from("session_profiles")
    .select("profile_id")
    .eq("session_id", session.id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!already && (count ?? 0) >= MAX_SESSION_PROFILES) {
    return NextResponse.json({ error: "Session is full (max 3 profiles)" }, { status: 400 });
  }

  if (!already) {
    const { error } = await admin
      .from("session_profiles")
      .insert({ session_id: session.id, profile_id: profile.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id });
}
