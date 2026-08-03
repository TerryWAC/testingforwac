import { NextResponse } from "next/server";
import { z } from "zod";

import { CATALOG } from "@/lib/catalog";
import { getFilmMeta } from "@/lib/filmMeta";
import { LIMITS, rateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

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

  const limited = rateLimit("runtimes", user.id, LIMITS.batch);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Catalog first (hand-tagged, free and instant), then the shared film_meta
  // cache for the rest. That cache is Postgres-backed, so a runtime looked up
  // here is still there on the next request and for every other feature —
  // this route used to keep its own in-memory map that died with the instance
  // and duplicated the TMDB lookup logic.
  const runtimes: Record<string, number | null> = {};
  const misses: { slug: string; title: string; year: number | null }[] = [];

  for (const item of parsed.data.items) {
    const entry = CATALOG.find((e) => norm(e.t) === norm(item.title));
    if (entry) {
      runtimes[item.slug] = entry.r;
    } else {
      misses.push(item);
    }
  }

  if (misses.length > 0) {
    try {
      const meta = await getFilmMeta(misses, misses.length);
      for (const item of misses) {
        runtimes[item.slug] = meta.get(item.slug)?.runtime ?? null;
      }
    } catch {
      for (const item of misses) runtimes[item.slug] = null;
    }
  }

  return NextResponse.json({ runtimes });
}
