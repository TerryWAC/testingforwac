import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REGION = "GB";
const memory = new Map<string, { providers: Provider[]; t: number }>();
const TTL = 24 * 3600 * 1000;

interface Provider {
  name: string;
  logoUrl: string | null;
  kind: "stream" | "rent";
}

const bodySchema = z.object({
  title: z.string().min(1).max(300),
  year: z.number().int().nullable(),
});

/** POST /api/where — which streaming services carry a film (TMDB, GB). */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json({ enabled: false, providers: [] });

  const { title, year } = parsed.data;
  const cacheKey = `${title.toLowerCase()}|${year ?? ""}`;
  const cached = memory.get(cacheKey);
  if (cached && Date.now() - cached.t < TTL) {
    return NextResponse.json({ enabled: true, providers: cached.providers });
  }

  try {
    const params = new URLSearchParams({ api_key: key, query: title, include_adult: "false" });
    if (year) params.set("year", String(year));
    const search = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
      signal: AbortSignal.timeout(6000),
    }).then((r) => r.json());
    const id = search?.results?.[0]?.id;
    if (!id) {
      memory.set(cacheKey, { providers: [], t: Date.now() });
      return NextResponse.json({ enabled: true, providers: [] });
    }

    const data = await fetch(
      `https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${key}`,
      { signal: AbortSignal.timeout(6000) }
    ).then((r) => r.json());

    const region = data?.results?.[REGION];
    const providers: Provider[] = [];
    const seen = new Set<string>();
    for (const p of region?.flatrate ?? []) {
      if (!seen.has(p.provider_name) && seen.add(p.provider_name)) {
        providers.push({
          name: p.provider_name,
          logoUrl: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
          kind: "stream",
        });
      }
    }
    for (const p of (region?.rent ?? []).slice(0, 4)) {
      if (!seen.has(p.provider_name) && seen.add(p.provider_name)) {
        providers.push({
          name: p.provider_name,
          logoUrl: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
          kind: "rent",
        });
      }
    }

    memory.set(cacheKey, { providers, t: Date.now() });
    return NextResponse.json({ enabled: true, providers });
  } catch {
    return NextResponse.json({ enabled: true, providers: [] });
  }
}
