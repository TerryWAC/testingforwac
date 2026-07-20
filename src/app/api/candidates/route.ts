import { NextResponse } from "next/server";
import { z } from "zod";

import { getFilmsForProfile } from "@/lib/db";
import { GENRE_NAMES, getFilmMeta } from "@/lib/filmMeta";
import { buildCandidates, buildDiscoveryCandidates, refineCandidates } from "@/lib/recommend";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  source: z.enum(["watchlist", "all", "classics"]).default("all"),
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

  const allFilms = await getFilmsForProfile(profile.id);
  const neutralFilters = {
    mood: "easy" as const,
    intensity: "medium" as const,
    runtimeCap: "any" as const,
    language: "any" as const,
    era: "any" as const,
    allowRewatches,
  };

  let candidates;
  if (source === "classics") {
    // Curated catalog minus anything the user has seen — pure discovery.
    candidates = buildDiscoveryCandidates(allFilms, neutralFilters, limit);
  } else {
    const films =
      source === "watchlist" ? allFilms.filter((f) => f.entry_type === "watchlist") : allFilms;
    // Feature pages have an explicit Classics source — keep these pure.
    candidates = buildCandidates(films, neutralFilters, limit, null);
  }

  try {
    const metaMap = await getFilmMeta(
      candidates.map((c) => ({ slug: c.slug, title: c.title, year: c.year })),
      10
    );
    candidates = refineCandidates(candidates, neutralFilters, metaMap, GENRE_NAMES);
  } catch {}

  return NextResponse.json({
    candidates: candidates.map((c) => ({
      slug: c.slug,
      title: c.title,
      year: c.year,
      reasons: c.reasons,
      discovery: c.discovery ?? false,
      runtime: c.runtime ?? null,
      genre: c.genreNames?.[0] ?? null,
    })),
  });
}
