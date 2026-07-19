import { NextResponse } from "next/server";

import { generateJoinCode } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST /api/sessions — create a compare session owned by the current user. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Set up your profile first" }, { status: 400 });

  const admin = createAdminClient();

  // Retry on the (unlikely) join-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    const { data: session, error } = await admin
      .from("sessions")
      .insert({ owner_user_id: user.id, join_code: joinCode })
      .select("id, join_code")
      .single();

    if (!error && session) {
      await admin
        .from("session_profiles")
        .insert({ session_id: session.id, profile_id: profile.id });
      return NextResponse.json({ sessionId: session.id, joinCode: session.join_code });
    }
    if (error && !error.message.includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not create session" }, { status: 500 });
}
