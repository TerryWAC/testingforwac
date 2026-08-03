import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST /api/profile/reset — delete all imported films (profile stays). */
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
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const admin = createAdminClient();
  const { error } = await admin.from("films").delete().eq("profile_id", profile.id);
  if (error) {
    console.error("library reset failed", error);
    return NextResponse.json({ error: "Could not clear your library" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
