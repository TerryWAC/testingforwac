import { NextResponse } from "next/server";
import { z } from "zod";

import { getFilmsForProfile } from "@/lib/db";
import { buildCandidates } from "@/lib/recommend";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  source: z.enum(["watchlist", "all"]).default("all"),
  allowRewatches: z.boolean().default(false),
  limit: z.number().int().min(1).max(60).default(40),
});

/**
 * POST /api/candidates — fast deterministic candidate pool (no AI call).
 * Powers the Wheel, Movie Match and Double Feature features.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { source, allowRewatches, limit } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "No profile yet" }, { status: 404 });

  let films = await getFilmsForProfile(profile.id);
  if (source === "watchlist") {
    films = films.filter((f) => f.entry_type === "watchlist");
  }

  const candidates = buildCandidates(
    films,
    {
      mood: "easy",
      intensity: "medium",
      runtimeCap: "any",
      language: "any",
      era: "any",
      allowRewatches,
    },
    limit
  );

  return NextResponse.json({
    candidates: candidates.map((c) => ({
      slug: c.slug,
      title: c.title,
      year: c.year,
      reasons: c.reasons,
    })),
  });
}
