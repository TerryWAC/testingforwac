import { NextResponse } from "next/server";

import { syncProfileFromRss } from "@/lib/db";
import { LIMITS, rateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST /api/sync — fetch the user's RSS feed and store new entries. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit("sync", user.id, LIMITS.feed);
  if (limited) return limited;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, rss_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "No profile yet" }, { status: 404 });

  try {
    const { added } = await syncProfileFromRss(profile);
    return NextResponse.json({ added });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 502 }
    );
  }
}
