"use client";

import { useEffect, useRef, useState } from "react";

interface PosterItem {
  slug: string;
  title: string;
  year: number | null;
}

const STORE_KEY = "lbnight-posters-v1";
const MAX_STORED = 600;

function readStore(): Record<string, string | null> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string | null>) {
  try {
    const entries = Object.entries(store);
    const trimmed = entries.length > MAX_STORED ? entries.slice(-MAX_STORED) : entries;
    localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {}
}

/**
 * Resolve posters for a set of films. Instant from localStorage when seen
 * before; otherwise one batched server call (TMDB key stays server-side).
 */
export function usePosters(items: PosterItem[]): Record<string, string | null> {
  const [posters, setPosters] = useState<Record<string, string | null>>({});
  // Slugs already asked for. Bailing out while a request was in flight meant
  // a second batch arriving mid-request was never fetched at all — its
  // posters shimmered forever, because the effect wouldn't re-run until the
  // slug list changed again.
  const requested = useRef<Set<string>>(new Set());
  const key = items.map((i) => i.slug).join(",");

  useEffect(() => {
    if (items.length === 0) return;
    const store = readStore();
    const cachedHits: Record<string, string | null> = {};
    const missing: PosterItem[] = [];
    for (const item of items) {
      if (item.slug in store) cachedHits[item.slug] = store[item.slug];
      else if (!requested.current.has(item.slug)) missing.push(item);
    }
    setPosters((prev) => ({ ...prev, ...cachedHits }));

    if (missing.length === 0) return;
    // Mark only what we actually send, so an oversized list isn't written off.
    const batch = missing.slice(0, 60);
    for (const item of batch) requested.current.add(item.slug);
    fetch("/api/posters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: batch }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.enabled || !json.posters) {
          // Poster lookups unavailable (no TMDB key) — resolve to null so the
          // designed fallback card shows instead of an endless shimmer. Not
          // persisted, so adding a key later re-fetches these.
          const nulls = Object.fromEntries(batch.map((m) => [m.slug, null]));
          setPosters((prev) => ({ ...nulls, ...prev }));
          return;
        }
        const fresh = json.posters as Record<string, string | null>;
        setPosters((prev) => ({ ...prev, ...fresh }));
        writeStore({ ...readStore(), ...fresh });
      })
      .catch(() => {
        const nulls = Object.fromEntries(batch.map((m) => [m.slug, null]));
        setPosters((prev) => ({ ...nulls, ...prev }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return posters;
}
