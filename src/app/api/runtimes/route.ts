import { NextResponse } from "next/server";
import { z } from "zod";

import { CATALOG } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const memory = new Map<string, number | null>();

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().min(1).max(200),
        title: z.string().min(1).max(300),
        year: z.number().int().nullable(),
      })
    )
    .max(12),
});

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

/** POST /api/runtimes — film runtimes in minutes (catalog first, then TMDB). */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const key = process.env.TMDB_API_KEY;
  const runtimes: Record<string, number | null> = {};

  await Promise.all(
    parsed.data.items.map(async (item) => {
      if (memory.has(item.slug)) {
        runtimes[item.slug] = memory.get(item.slug)!;
        return;
      }
      // Curated catalog carries hand-tagged runtimes — free and instant.
      const entry = CATALOG.find((e) => norm(e.t) === norm(item.title));
      if (entry) {
        memory.set(item.slug, entry.r);
        runtimes[item.slug] = entry.r;
        return;
      }
      if (!key) {
        runtimes[item.slug] = null;
        return;
      }
      try {
        const params = new URLSearchParams({ api_key: key, query: item.title });
        if (item.year) params.set("year", String(item.year));
        const search = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
          signal: AbortSignal.timeout(6000),
        }).then((r) => r.json());
        const id = search?.results?.[0]?.id;
        if (!id) {
          memory.set(item.slug, null);
          runtimes[item.slug] = null;
          return;
        }
        const detail = await fetch(
          `https://api.themoviedb.org/3/movie/${id}?api_key=${key}`,
          { signal: AbortSignal.timeout(6000) }
        ).then((r) => r.json());
        const mins = typeof detail?.runtime === "number" && detail.runtime > 0 ? detail.runtime : null;
        memory.set(item.slug, mins);
        runtimes[item.slug] = mins;
      } catch {
        runtimes[item.slug] = null;
      }
    })
  );

  return NextResponse.json({ runtimes });
}
