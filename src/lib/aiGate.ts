import "server-only";

import { createHash } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RecommendResponse } from "@/lib/types";

const DAILY_AI_LIMIT = 10;
const CACHE_TTL_HOURS = 24;

/** Stable cache key from everything that affects the AI output. */
export function buildCacheKey(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Same ai_cache table, any JSON payload. Used for intermediate model output
 * (e.g. suggested titles awaiting TMDB verification) rather than a finished
 * response.
 */
export async function getCachedJson<T>(cacheKey: string): Promise<T | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_cache")
    .select("response_json, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await admin.from("ai_cache").delete().eq("cache_key", cacheKey);
    return null;
  }
  return data.response_json as T;
}

export async function setCachedJson(cacheKey: string, payload: unknown) {
  const admin = createAdminClient();
  const expires = new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
  await admin
    .from("ai_cache")
    .upsert(
      { cache_key: cacheKey, response_json: payload, expires_at: expires },
      { onConflict: "cache_key" }
    );
}

export async function getCachedResponse(cacheKey: string): Promise<RecommendResponse | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_cache")
    .select("response_json, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    // Opportunistic housekeeping: sweep all expired entries, not just this one.
    void admin.from("ai_cache").delete().lt("expires_at", new Date().toISOString());
    return null;
  }
  return data.response_json as RecommendResponse;
}

export async function setCachedResponse(cacheKey: string, response: RecommendResponse) {
  const admin = createAdminClient();
  const expires = new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
  await admin
    .from("ai_cache")
    .upsert(
      { cache_key: cacheKey, response_json: response, expires_at: expires },
      { onConflict: "cache_key" }
    );
}

/**
 * Consume one AI generation for the user today. Returns false when the daily
 * limit is exhausted — callers must then serve deterministic results.
 */
export async function tryConsumeAiQuota(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await admin
    .from("ai_usage")
    .select("id, count")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin
      .from("ai_usage")
      .insert({ user_id: userId, day: today, count: 1 });
    return !error;
  }

  if (existing.count >= DAILY_AI_LIMIT) return false;

  // Guarded update prevents racing past the limit.
  const { data: updated } = await admin
    .from("ai_usage")
    .update({ count: existing.count + 1 })
    .eq("id", existing.id)
    .lt("count", DAILY_AI_LIMIT)
    .select("id");
  return (updated?.length ?? 0) > 0;
}
