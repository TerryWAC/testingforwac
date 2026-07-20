"use client";

/**
 * Recently shown pick slugs — sent to the server as an exclusion list so
 * repeated "Recommend" clicks surface fresh films instead of the same eight.
 */
const KEY = "lbnight-recent-picks";
const MAX = 24;

export function getRecentPicks(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function addRecentPicks(slugs: string[]) {
  try {
    const merged = [...slugs, ...getRecentPicks()];
    sessionStorage.setItem(KEY, JSON.stringify([...new Set(merged)].slice(0, MAX)));
  } catch {}
}
