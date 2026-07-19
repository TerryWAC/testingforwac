import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({ slug: z.string().min(1).max(200) });

/**
 * POST /api/film-info — the user's own history for one film: rating,
 * watch dates, review text, watchlist status.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("films")
    .select("rating, watched_date, entry_type, review")
    .eq("profile_id", profile.id)
    .eq("film_slug", parsed.data.slug);

  const entries = rows ?? [];
  const ratings = entries.map((r) => r.rating).filter((r): r is number => r !== null);
  const watchDates = [
    ...new Set(
      entries
        .filter((r) => r.entry_type !== "watchlist" && r.watched_date)
        .map((r) => r.watched_date as string)
    ),
  ].sort((a, b) => (a < b ? 1 : -1));
  const review = entries.find((r) => r.review)?.review ?? null;

  return NextResponse.json({
    inLibrary: entries.length > 0,
    rating: ratings.length > 0 ? Math.max(...ratings) : null,
    watchDates: watchDates.slice(0, 10),
    timesWatched: watchDates.length,
    onWatchlist: entries.some((r) => r.entry_type === "watchlist"),
    review,
  });
}
