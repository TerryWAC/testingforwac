import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { FilmUpsert } from "@/lib/import";
import { fetchRssData } from "@/lib/rss";
import type { FilmRow, Profile } from "@/lib/types";

/** Sync at most once per this window unless the user asks explicitly. */
export const AUTO_SYNC_STALE_HOURS = 6;

// Review text is heavy and only the profile page needs it — skip by default.
const FILM_COLUMNS =
  "id, profile_id, film_slug, title, year, rating, watched_date, entry_type, source, created_at, updated_at";

export async function getFilmsForProfile(
  profileId: string,
  opts?: { withReviews?: boolean }
): Promise<FilmRow[]> {
  const admin = createAdminClient();
  const all: FilmRow[] = [];
  const page = 1000;
  // Page past PostgREST's default row cap so big libraries load fully.
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("films")
      .select(opts?.withReviews ? "*" : FILM_COLUMNS)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as FilmRow[]) {
      if (!opts?.withReviews) row.review = null;
      all.push(row);
    }
    if (!data || data.length < page) break;
  }
  return all;
}

/**
 * Just the slugs in a profile's library.
 *
 * Some callers (the friend-overlap boost) only need to answer "is this film
 * in that library?" — reading full rows to build a set means deserialising
 * thousands of titles, dates and ratings to throw them all away.
 */
export async function getFilmSlugsForProfile(profileId: string): Promise<string[]> {
  const admin = createAdminClient();
  const slugs: string[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("films")
      .select("film_slug")
      .eq("profile_id", profileId)
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) slugs.push(row.film_slug);
    if (!data || data.length < page) break;
  }
  return slugs;
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

  // Page past PostgREST's 1000-row cap. Reading only the first page would
  // leave existing rows out of `seen`, so we'd try to re-insert them and the
  // unique index would abort the whole batch — every sync and every re-import
  // failing outright once a library passes 1000 rows.
  const seen = new Set<string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("films")
      .select("film_slug, watched_date, entry_type")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const f of data ?? []) {
      seen.add(`${f.film_slug}|${f.watched_date ?? ""}|${f.entry_type}`);
    }
    if (!data || data.length < page) break;
  }

  // Filter against what's stored, and against the batch itself — a feed that
  // lists the same film twice on one day would otherwise trip the unique
  // index and take the whole insert down with it.
  const fresh = films.filter((f) => {
    const key = `${f.film_slug}|${f.watched_date ?? ""}|${f.entry_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

/** Fetch the profile's feed and store new entries (and the avatar, if shown). */
export async function syncProfileFromRss(
  profile: Pick<Profile, "id" | "rss_url">
): Promise<{ added: number }> {
  const { films, avatarUrl } = await fetchRssData(profile.rss_url);
  const added = await insertMissingFilms(profile.id, films);

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (avatarUrl) {
    // Never clobber an avatar the user uploaded themselves.
    await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id)
      .is("avatar_url", null);
  }

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
