import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { FilmUpsert } from "@/lib/import";
import { fetchRssFilms } from "@/lib/rss";
import type { FilmRow, Profile } from "@/lib/types";

/** Sync at most once per this window unless the user asks explicitly. */
export const AUTO_SYNC_STALE_HOURS = 6;

export async function getFilmsForProfile(profileId: string): Promise<FilmRow[]> {
  const admin = createAdminClient();
  const all: FilmRow[] = [];
  const page = 1000;
  // Page past PostgREST's default row cap so big libraries load fully.
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("films")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as FilmRow[]));
    if (!data || data.length < page) break;
  }
  return all;
}

/**
 * Insert film rows that aren't already stored. The films table's unique index
 * is expression-based (nulls coalesced), which PostgREST upserts can't target,
 * so we dedupe here: read existing keys, insert only the missing rows.
 */
export async function insertMissingFilms(
  profileId: string,
  films: FilmUpsert[]
): Promise<number> {
  if (films.length === 0) return 0;
  const admin = createAdminClient();

  const { data: existing, error } = await admin
    .from("films")
    .select("film_slug, watched_date, entry_type")
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);

  const seen = new Set(
    (existing ?? []).map((f) => `${f.film_slug}|${f.watched_date ?? ""}|${f.entry_type}`)
  );

  const fresh = films.filter(
    (f) => !seen.has(`${f.film_slug}|${f.watched_date ?? ""}|${f.entry_type}`)
  );
  if (fresh.length === 0) return 0;

  const rows = fresh.map((f) => ({ ...f, profile_id: profileId }));
  const batch = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const { error: insertError } = await admin.from("films").insert(rows.slice(i, i + batch));
    if (insertError) throw new Error(insertError.message);
    inserted += Math.min(batch, rows.length - i);
  }
  return inserted;
}

/** Replace the CSV-sourced library (used by import / re-import). */
export async function replaceCsvFilms(profileId: string, films: FilmUpsert[]): Promise<number> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("films")
    .delete()
    .eq("profile_id", profileId)
    .eq("source", "csv");
  if (error) throw new Error(error.message);
  return insertMissingFilms(profileId, films);
}

/** Fetch the profile's RSS feed and store any new entries. */
export async function syncProfileFromRss(
  profile: Pick<Profile, "id" | "rss_url">
): Promise<{ added: number }> {
  const films = await fetchRssFilms(profile.rss_url);
  const added = await insertMissingFilms(profile.id, films);

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", profile.id);

  return { added };
}

export function isSyncStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > AUTO_SYNC_STALE_HOURS * 3600 * 1000;
}

export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusable chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
