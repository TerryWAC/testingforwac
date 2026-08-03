import "server-only";

import { NextResponse } from "next/server";

/**
 * Per-user request limiting for routes that spend someone else's budget —
 * TMDB lookups, Letterboxd feed fetches, ZIP parsing.
 *
 * Authentication alone isn't enough here: a signed-in account can still burn
 * the shared TMDB key's rate limit or hammer letterboxd.com from our IP, and
 * a public app has to assume someone will.
 *
 * Deliberately in-memory. It's a sliding window per serverless instance, so a
 * caller spread across many cold instances gets a higher effective ceiling —
 * but bursts, which is what actually causes damage, hit one warm instance and
 * are stopped. A Postgres-backed counter would be exact at the cost of a
 * round trip on every request and another migration; that's the upgrade if
 * this ever sees real traffic.
 */

const windows = new Map<string, number[]>();
const MAX_KEYS = 5000;

export interface Limit {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const LIMITS = {
  /** Cheap-ish TMDB reads, called routinely as the user browses. */
  browse: { limit: 60, windowMs: 5 * 60_000 },
  /** Batched TMDB lookups — one request can mean dozens of upstream calls. */
  batch: { limit: 30, windowMs: 5 * 60_000 },
  /** Outbound fetches to letterboxd.com. Be a good citizen. */
  feed: { limit: 12, windowMs: 60 * 60_000 },
  /** Multi-megabyte ZIP parsing. */
  upload: { limit: 6, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;

/** Record a hit. Returns false when the caller is over their allowance. */
export function allow(key: string, { limit, windowMs }: Limit): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    windows.set(key, hits);
    return false;
  }

  hits.push(now);
  // Evict an arbitrary older key rather than growing without bound.
  if (!windows.has(key) && windows.size >= MAX_KEYS) {
    const oldest = windows.keys().next().value;
    if (oldest !== undefined) windows.delete(oldest);
  }
  windows.set(key, hits);
  return true;
}

/**
 * Guard a route. Returns a 429 response to return immediately, or null when
 * the request may proceed.
 */
export function rateLimit(bucket: string, userId: string, limit: Limit): NextResponse | null {
  if (allow(`${bucket}:${userId}`, limit)) return null;
  return NextResponse.json(
    { error: "You're going a bit fast — give it a minute and try again." },
    { status: 429, headers: { "Retry-After": String(Math.ceil(limit.windowMs / 1000)) } }
  );
}
