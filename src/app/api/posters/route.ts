import { NextResponse } from "next/server";
import { z } from "zod";

import { findPoster } from "@/lib/posters";
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
    .max(60),
});

/** POST /api/posters — resolve film posters server-side (TMDB key stays here). */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json({ posters: {}, enabled: false });
  }

  const posters: Record<string, string | null> = {};
  await Promise.all(
    parsed.data.items.map(async (item) => {
      posters[item.slug] = await findPoster(item.slug, item.title, item.year);
    })
  );

  return NextResponse.json({ posters, enabled: true });
}
