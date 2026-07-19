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
    .map(
      (c) =>
        `- slug:${c.slug} | ${c.title}${c.year ? ` (${c.year})` : ""} | signals: ${
          c.reasons.join("; ") || "none"
        }`
    )
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
