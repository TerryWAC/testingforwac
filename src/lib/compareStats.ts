import type { FilmRow } from "@/lib/types";

export interface MemberLibrary {
  profileId: string;
  username: string;
  isGuest: boolean;
  films: FilmRow[];
}

export interface OverlapStats {
  members: { username: string; filmCount: number; isGuest: boolean }[];
  sharedFilms: { slug: string; title: string; year: number | null }[];
  sharedTopDecades: { decade: string; count: number }[];
  ratingSimilarity: { pair: string; similarityPct: number; sharedRated: number }[];
}

/** Overlap stats across 2-3 member libraries, based on available data. */
export function computeOverlap(members: MemberLibrary[]): OverlapStats {
  const slugSets = members.map(
    (m) => new Map(m.films.map((f) => [f.film_slug, f] as const))
  );

  // Films present in every library.
  const sharedFilms: OverlapStats["sharedFilms"] = [];
  if (members.length >= 2) {
    const [first, ...rest] = slugSets;
    for (const [slug, film] of first) {
      if (rest.every((s) => s.has(slug))) {
        sharedFilms.push({ slug, title: film.title, year: film.year });
      }
    }
  }

  // Decades that everyone watches.
  const decadeCounts = new Map<string, number>();
  for (const m of members) {
    const seen = new Set<string>();
    for (const f of m.films) {
      if (f.year) {
        const decade = `${Math.floor(f.year / 10) * 10}s`;
        if (!seen.has(decade)) {
          seen.add(decade);
          decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
        }
      }
    }
  }
  const sharedTopDecades = [...decadeCounts.entries()]
    .filter(([, count]) => count === members.length)
    .map(([decade]) => ({
      decade,
      count: members.reduce(
        (sum, m) =>
          sum +
          m.films.filter((f) => f.year && `${Math.floor(f.year / 10) * 10}s` === decade).length,
        0
      ),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Pairwise rating similarity over films both rated (0-5 scale).
  const ratingSimilarity: OverlapStats["ratingSimilarity"] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const aRatings = new Map(
        members[i].films.filter((f) => f.rating !== null).map((f) => [f.film_slug, f.rating!])
      );
      let diffs = 0;
      let shared = 0;
      for (const f of members[j].films) {
        if (f.rating !== null && aRatings.has(f.film_slug)) {
          diffs += Math.abs(aRatings.get(f.film_slug)! - f.rating);
          shared++;
        }
      }
      ratingSimilarity.push({
        pair: `${members[i].username} × ${members[j].username}`,
        similarityPct: shared > 0 ? Math.round((1 - diffs / shared / 5) * 100) : 0,
        sharedRated: shared,
      });
    }
  }

  return {
    members: members.map((m) => ({
      username: m.username,
      filmCount: new Set(m.films.map((f) => f.film_slug)).size,
      isGuest: m.isGuest,
    })),
    sharedFilms: sharedFilms.slice(0, 30),
    sharedTopDecades,
    ratingSimilarity,
  };
}
