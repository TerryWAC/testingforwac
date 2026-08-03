import { NextResponse } from "next/server";

import { LIMITS, rateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const IMG = "https://image.tmdb.org/t/p/w185";

/**
 * GET /api/person?q=... — search people (directors, actors).
 * GET /api/person?id=... — filmography for one person.
 * TMDB's official API — no scraping.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited = rateLimit("person", user.id, LIMITS.browse);
  if (limited) return limited;

  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json({ enabled: false });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const id = url.searchParams.get("id");

  try {
    if (q) {
      const data = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${key}&query=${encodeURIComponent(q)}&include_adult=false`,
        { signal: AbortSignal.timeout(6000) }
      ).then((r) => r.json());
      const people = (data?.results ?? []).slice(0, 6).map(
        (p: {
          id: number;
          name: string;
          profile_path: string | null;
          known_for_department: string;
        }) => ({
          id: p.id,
          name: p.name,
          photoUrl: p.profile_path ? `${IMG}${p.profile_path}` : null,
          role: p.known_for_department === "Directing" ? "Director" : p.known_for_department,
        })
      );
      return NextResponse.json({ enabled: true, people });
    }

    if (id && /^\d+$/.test(id)) {
      const data = await fetch(
        `https://api.themoviedb.org/3/person/${id}/movie_credits?api_key=${key}`,
        { signal: AbortSignal.timeout(8000) }
      ).then((r) => r.json());

      interface Credit {
        id: number;
        title?: string;
        release_date?: string;
        poster_path?: string | null;
        job?: string;
        character?: string;
        popularity?: number;
        vote_count?: number;
      }

      const seen = new Set<number>();
      const films: {
        title: string;
        year: number | null;
        posterUrl: string | null;
        role: string;
      }[] = [];

      const directed: Credit[] = (data?.crew ?? []).filter((c: Credit) => c.job === "Director");
      const acted: Credit[] = (data?.cast ?? []).filter((c: Credit) => (c.vote_count ?? 0) > 50);

      for (const c of [...directed, ...acted]) {
        if (!c.title || seen.has(c.id)) continue;
        seen.add(c.id);
        films.push({
          title: c.title,
          year: c.release_date ? Number(c.release_date.slice(0, 4)) || null : null,
          posterUrl: c.poster_path ? `https://image.tmdb.org/t/p/w342${c.poster_path}` : null,
          role: c.job === "Director" ? "Director" : (c.character ?? "Actor"),
        });
      }
      films.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      return NextResponse.json({ enabled: true, films: films.slice(0, 60) });
    }

    return NextResponse.json({ error: "Missing q or id" }, { status: 400 });
  } catch {
    return NextResponse.json({ enabled: true, people: [], films: [] });
  }
}
