import { NextResponse } from "next/server";

import {
  buildCacheKey,
  getCachedJson,
  getCachedResponse,
  setCachedJson,
  setCachedResponse,
  tryConsumeAiQuota,
} from "@/lib/aiGate";
import { GENRE_NAMES, getCachedMeta, getFilmMeta } from "@/lib/filmMeta";
import { getFilmsForProfile } from "@/lib/db";
import { fetchDiscoverCandidates, verifySuggestions } from "@/lib/discover";
import { polishWithGemini, suggestTitles } from "@/lib/gemini";
import {
  blendGroupCandidates,
  buildCandidates,
  deterministicPicks,
  ensureDiscoveryMix,
  genreAffinity,
  refineCandidates,
} from "@/lib/recommend";
import { recommendRequestSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FilmRow, RecommendResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/ai/recommend — two-stage engine.
 * Stage 1 always runs (deterministic candidates). Stage 2 is a single Gemini
 * call, gated by a 24h cache and a 10/day per-user quota; any failure falls
 * back to deterministic picks so the button always works.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = recommendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { filters, count, chatMessage, sessionId, excludeSlugs } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, letterboxd_username")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "No profile yet" }, { status: 404 });

  // ---- Stage 1: deterministic candidates ----
  let candidates;
  let groupContext: string | undefined;
  // The signed-in user's own library, kept for the AI-suggestion stage below.
  let library: FilmRow[] = [];
  // How this user rates each genre against their own baseline, learned from
  // the metadata cache. Empty until there's enough rated history to model.
  let affinity = new Map<number, number>();

  if (sessionId) {
    // Compare mode: only profiles in a session the user belongs to are visible.
    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("session_profiles")
      .select("profile_id, sessions!inner(owner_user_id)")
      .eq("session_id", sessionId);

    const memberIds = (membership ?? []).map((m) => m.profile_id);
    const { data: session } = await admin
      .from("sessions")
      .select("owner_user_id")
      .eq("id", sessionId)
      .maybeSingle();
    const isMember = memberIds.includes(profile.id) || session?.owner_user_id === user.id;
    if (!session || !isMember) {
      return NextResponse.json({ error: "Not part of this session" }, { status: 403 });
    }

    const { data: memberProfiles } = await admin
      .from("profiles")
      .select("id, letterboxd_username")
      .in("id", memberIds.length > 0 ? memberIds : [profile.id]);

    const perProfile = await Promise.all(
      (memberProfiles ?? []).slice(0, 3).map(async (p) => ({
        profileName: p.letterboxd_username,
        candidates: buildCandidates(await getFilmsForProfile(p.id), filters),
      }))
    );
    candidates = blendGroupCandidates(perProfile);
    groupContext = `Choosing for ${perProfile.length} people (${perProfile
      .map((p) => p.profileName)
      .join(", ")}). Prefer films flagged as being in multiple libraries.`;
  } else {
    const films = await getFilmsForProfile(profile.id);
    library = films;
    candidates = buildCandidates(films, filters);

    try {
      const libraryMeta = await getCachedMeta(
        films.filter((f) => f.rating !== null).map((f) => f.film_slug)
      );
      affinity = genreAffinity(films, libraryMeta);
    } catch {
      // Taste modelling is best-effort; scoring still works without it.
    }

    // Widen discovery past the curated catalog with TMDB's Discover API,
    // filtered by tonight's settings and the genres this user rates highly.
    try {
      const external = await fetchDiscoverCandidates(filters, films, affinity, 12);
      if (external.length > 0) {
        const known = new Set(candidates.map((c) => c.slug));
        candidates = [...candidates, ...external.filter((c) => !known.has(c.slug))];
      }
    } catch {
      // Curated catalog discovery still applies.
    }

    // Friend-aware boost: films your friends have watched or watchlisted get
    // a social signal in the "why" — great picks for shared taste.
    try {
      const admin = createAdminClient();
      const { data: friendRows } = await admin
        .from("friends")
        .select("profile_id, profiles!inner(letterboxd_username)")
        .eq("owner_user_id", user.id)
        .limit(3);
      if (friendRows && friendRows.length > 0) {
        // Fetch friends' libraries concurrently. Serially this cost three full
        // library reads back to back on every Recommend press, which matters
        // now that a friend's export ZIP can carry thousands of films.
        const libraries = await Promise.all(
          friendRows.map(async (row) => ({
            name: (row.profiles as unknown as { letterboxd_username: string })
              .letterboxd_username,
            films: await getFilmsForProfile(row.profile_id),
          }))
        );
        const friendFilms = new Map<string, string>();
        for (const { name, films: fFilms } of libraries) {
          for (const f of fFilms) {
            if (!friendFilms.has(f.film_slug)) friendFilms.set(f.film_slug, name);
          }
        }
        for (const c of candidates) {
          const friendName = friendFilms.get(c.slug);
          if (friendName) {
            c.score += 3;
            c.reasons.push(`@${friendName} has it in their orbit too`);
          }
        }
        candidates.sort((a, b) => b.score - a.score);
      }
    } catch {
      // Social enrichment is best-effort — recommendations never fail on it.
    }
  }

  // Thin pool (narrow filters, small or well-watched library): let the model
  // name films from its own knowledge of cinema, then verify every title
  // against TMDB so nothing invented reaches the user. Cached for 24h and
  // charged to the same daily quota as the polish call, because it is one.
  if (!sessionId && candidates.length < count * 2 && process.env.GEMINI_API_KEY) {
    try {
      const lovedTitles = [
        ...new Map(
          library
            .filter((f) => f.rating !== null && f.rating >= 4.5 && f.entry_type !== "watchlist")
            .map((f) => [f.film_slug, f.title])
        ).values(),
      ].slice(0, 12);

      const suggestKey = buildCacheKey({
        v: 1,
        kind: "suggest",
        profileId: profile.id,
        filters,
        chatMessage: chatMessage ?? null,
      });

      let suggestions = await getCachedJson<{ title: string; year: number | null }[]>(suggestKey);
      if (!suggestions && (await tryConsumeAiQuota(user.id))) {
        suggestions = await suggestTitles(filters, lovedTitles, chatMessage);
        await setCachedJson(suggestKey, suggestions);
      }

      if (suggestions && suggestions.length > 0) {
        const verified = await verifySuggestions(suggestions, filters, library, affinity, 8);
        const known = new Set(candidates.map((c) => c.slug));
        candidates = [...candidates, ...verified.filter((c) => !known.has(c.slug))];
      }
    } catch {
      // Suggestions are a bonus lane — never fail the request over them.
    }
  }

  // Real metadata pass: genres, runtime, language, acclaim (progressively
  // cached in film_meta, so coverage and quality grow with every request).
  try {
    const metaMap = await getFilmMeta(
      candidates.map((c) => ({ slug: c.slug, title: c.title, year: c.year })),
      // The candidate pool roughly doubled once external sources landed, so
      // lift the per-request fetch budget to keep coverage growing at the
      // same rate. Lookups run concurrently.
      20
    );
    candidates = refineCandidates(candidates, filters, metaMap, GENRE_NAMES, affinity);
  } catch {}

  // Score order alone lets a big watchlist crowd out everything new.
  candidates = ensureDiscoveryMix(candidates);

  // Variety: drop recently shown picks unless that would starve the results.
  if (excludeSlugs.length > 0) {
    const excluded = new Set(excludeSlugs);
    const fresh = candidates.filter((c) => !excluded.has(c.slug));
    if (fresh.length >= count) candidates = fresh;
  }

  if (candidates.length === 0) {
    return NextResponse.json({ picks: [], source: "deterministic" } satisfies RecommendResponse);
  }

  const fallback: RecommendResponse = {
    picks: deterministicPicks(candidates, filters, count),
    source: "deterministic",
  };

  // ---- Stage 2: AI polish (cached, rate-limited, always falls back) ----
  const cacheKey = buildCacheKey({
    v: 1,
    profileId: profile.id,
    sessionId: sessionId ?? null,
    filters,
    count,
    chatMessage: chatMessage ?? null,
    candidateSlugs: candidates.map((c) => c.slug),
  });

  try {
    const cached = await getCachedResponse(cacheKey);
    if (cached) return NextResponse.json(cached);

    if (!process.env.GEMINI_API_KEY) return NextResponse.json(fallback);

    const allowed = await tryConsumeAiQuota(user.id);
    if (!allowed) return NextResponse.json(fallback);

    const ai = await polishWithGemini(candidates, filters, count, chatMessage, groupContext);
    const response: RecommendResponse = { picks: ai.picks, source: "ai", followUp: ai.followUp };
    await setCachedResponse(cacheKey, response);
    return NextResponse.json(response);
  } catch {
    // Gemini error / quota / malformed output — deterministic picks still ship.
    return NextResponse.json(fallback);
  }
}
