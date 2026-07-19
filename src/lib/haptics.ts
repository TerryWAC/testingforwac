"use client";

/** Tiny haptic tap on supporting mobile devices; silently no-ops elsewhere. */
export function buzz(pattern: number | number[] = 15) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
