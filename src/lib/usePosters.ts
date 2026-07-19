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
  const inFlight = useRef(false);
  const key = items.map((i) => i.slug).join(",");

  useEffect(() => {
    if (items.length === 0) return;
    const store = readStore();
    const cachedHits: Record<string, string | null> = {};
    const missing: PosterItem[] = [];
    for (const item of items) {
      if (item.slug in store) cachedHits[item.slug] = store[item.slug];
      else missing.push(item);
    }
    setPosters((prev) => ({ ...prev, ...cachedHits }));

    if (missing.length === 0 || inFlight.current) return;
    inFlight.current = true;
    fetch("/api/posters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: missing.slice(0, 60) }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.enabled || !json.posters) return;
        const fresh = json.posters as Record<string, string | null>;
        setPosters((prev) => ({ ...prev, ...fresh }));
        writeStore({ ...readStore(), ...fresh });
      })
      .catch(() => {})
      .finally(() => {
        inFlight.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return posters;
}
