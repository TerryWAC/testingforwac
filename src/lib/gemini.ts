import "server-only";

import type { Candidate } from "@/lib/recommend";
import type { Pick, TonightFilters } from "@/lib/types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const TIMEOUT_MS = 12_000;

interface GeminiResult {
  picks: Pick[];
  followUp?: string;
}

const ERA_HINT: Record<TonightFilters["era"], string> = {
  any: "any era",
  "2020s": "released 2020-2029",
  "2010s": "released 2010-2019",
  "2000s": "released 2000-2009",
  "1990s": "released 1990-1999",
  "1980s": "released 1980-1989",
  "1970s": "released 1970-1979",
  pre1970: "released before 1970",
};

/**
 * Ask Gemini to NAME films rather than rank them — used when the deterministic
 * pool is thin, where a language model's breadth of film knowledge beats any
 * catalog we could ship.
 *
 * Output is treated as unverified: the caller resolves every title through
 * TMDB and discards anything that doesn't exist. That turns the model's
 * tendency to invent plausible titles from a correctness problem into a
 * recall filter.
 */
export async function suggestTitles(
  filters: TonightFilters,
  lovedTitles: string[],
  chatMessage?: string
): Promise<{ title: string; year: number | null }[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const prompt = [
    "You are a film archivist with encyclopedic knowledge of cinema, including cult films, festival titles and overlooked work.",
    `Name 12 real films for tonight: mood=${filters.mood}, intensity=${filters.intensity}, runtime=${filters.runtimeCap}, language=${filters.language}, ${ERA_HINT[filters.era]}.`,
    lovedTitles.length > 0
      ? `This viewer rated these highly: ${lovedTitles.slice(0, 12).join(", ")}. Lean toward that sensibility.`
      : "",
    chatMessage ? `They said: "${chatMessage}"` : "",
    "Favour well-regarded but less obvious choices over blockbusters. Do not invent films.",
    'Return STRICT JSON only, no markdown: {"films":[{"title":"exact title","year":1999}]}',
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9, // breadth matters more than consistency here
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  const parsed = JSON.parse(text) as { films?: { title?: string; year?: number }[] };
  if (!Array.isArray(parsed.films)) return [];

  return parsed.films
    .filter((f): f is { title: string; year?: number } => typeof f.title === "string" && !!f.title)
    .map((f) => ({
      title: f.title.slice(0, 200),
      year: Number.isInteger(f.year) && f.year! > 1870 ? f.year! : null,
    }))
    .slice(0, 12);
}

/**
 * Stage 2 — one Gemini call to rank/trim candidates and write short "why"
 * blurbs. Never called from the client; throws on any failure so the caller
 * can fall back to deterministic picks.
 */
export async function polishWithGemini(
  candidates: Candidate[],
  filters: TonightFilters,
  count: number,
  chatMessage?: string,
  groupContext?: string
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const candidateList = candidates
    .map((c) => {
      const meta = [
        c.runtime ? `${c.runtime} min` : null,
        c.genreNames?.length ? c.genreNames.join("/") : null,
        c.vote ? `TMDB ${c.vote}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `- slug:${c.slug} | ${c.title}${c.year ? ` (${c.year})` : ""}${meta ? ` | ${meta}` : ""} | signals: ${c.reasons.join("; ") || "none"}`;
    })
    .join("\n");

  const prompt = [
    "You are a movie-night concierge. Choose the best films for tonight FROM THE CANDIDATE LIST ONLY.",
    `Constraints: mood=${filters.mood}, intensity=${filters.intensity}, runtime=${filters.runtimeCap}, language=${filters.language}, era=${filters.era}, rewatches=${filters.allowRewatches ? "allowed" : "not allowed"}.`,
    groupContext ? `Group context: ${groupContext}` : "",
    chatMessage ? `The user said: "${chatMessage}"` : "",
    `Return STRICT JSON only, no markdown: {"picks":[{"slug":"...","why":"..."}],"followUp":"optional single short question or omit"}.`,
    `Pick exactly ${count}. Each "why" must be 1-2 short sentences, specific to the user's taste signals. Use your film knowledge to match mood/intensity/runtime to titles you recognize; if unsure a film fits, prefer ones you know.`,
    "Candidates:",
    candidateList,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800, // hard cap — blurbs are short
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  const parsed = JSON.parse(text) as {
    picks?: { slug?: string; why?: string }[];
    followUp?: string;
  };
  if (!Array.isArray(parsed.picks)) throw new Error("Gemini returned malformed JSON");

  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  const picks: Pick[] = [];
  for (const p of parsed.picks) {
    const cand = p.slug ? bySlug.get(p.slug) : undefined;
    if (!cand) continue; // ignore hallucinated slugs
    picks.push({
      title: cand.title,
      year: cand.year,
      slug: cand.slug,
      discovery: cand.discovery,
      why: (p.why ?? "").slice(0, 240) || "A strong match for tonight.",
    });
    if (picks.length === count) break;
  }
  if (picks.length === 0) throw new Error("Gemini picked no valid candidates");

  return {
    picks,
    followUp:
      typeof parsed.followUp === "string" && parsed.followUp.trim()
        ? parsed.followUp.trim().slice(0, 200)
        : undefined,
  };
}
