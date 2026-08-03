import { NextResponse } from "next/server";

import { syncProfileFromRss } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, rateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const STALE_MS = 12 * 3600 * 1000;
const MAX_PER_CALL = 8;

/**
 * POST /api/friends/sync — refresh stale friend feeds.
 *
 * This used to run inside the profile page's render, which meant the page
 * couldn't paint until up to eight Letterboxd feeds had been fetched (each
 * with a 10s timeout). Doing it here lets the page render immediately and
 * refresh once new activity actually lands.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit("friend-sync", user.id, LIMITS.feed);
  if (limited) return limited;

  const admin = createAdminClient();
  const { data: friendRows } = await admin
    .from("friends")
    .select("profile_id, profiles!inner(last_synced_at, rss_url)")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_CALL);

  const stale = (friendRows ?? []).filter((row) => {
    const p = row.profiles as unknown as { last_synced_at: string | null };
    return !p.last_synced_at || Date.now() - new Date(p.last_synced_at).getTime() > STALE_MS;
  });
  if (stale.length === 0) return NextResponse.json({ added: 0, synced: 0 });

  const results = await Promise.all(
    stale.map(async (row) => {
      const p = row.profiles as unknown as { rss_url: string };
      try {
        const { added } = await syncProfileFromRss({ id: row.profile_id, rss_url: p.rss_url });
        return added;
      } catch {
        return 0;
      }
    })
  );

  return NextResponse.json({
    synced: stale.length,
    added: results.reduce((sum, n) => sum + n, 0),
  });
}
