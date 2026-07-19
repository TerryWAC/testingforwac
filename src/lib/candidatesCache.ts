"use client";

export interface CandidateItem {
  slug: string;
  title: string;
  year: number | null;
  reasons: string[];
}

const TTL_MS = 5 * 60_000;

/**
 * Fetch the deterministic candidate pool with a short sessionStorage cache,
 * so hopping between Wheel / Match / Double / Final Cut is instant.
 */
export async function fetchCandidates(
  source: "watchlist" | "all",
  allowRewatches: boolean,
  limit = 40
): Promise<CandidateItem[]> {
  const key = `lbnight-cand-${source}-${allowRewatches}-${limit}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (cached && Date.now() - cached.t < TTL_MS && Array.isArray(cached.v)) {
      return cached.v;
    }
  } catch {}

  const res = await fetch("/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, allowRewatches, limit }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not load films");
  const candidates: CandidateItem[] = json.candidates ?? [];
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: candidates }));
  } catch {}
  return candidates;
}

/** Fire-and-forget warmup so feature pages open instantly from the dashboard. */
export function warmCandidates() {
  fetchCandidates("watchlist", false).catch(() => {});
  fetchCandidates("all", false).catch(() => {});
}
