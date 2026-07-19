import "server-only";

import JSZip from "jszip";

import { parseCsv } from "@/lib/csv";
import { deriveSlug, slugFromUrl } from "@/lib/slug";
import type { EntryType, ImportSummary } from "@/lib/types";

export interface FilmUpsert {
  film_slug: string;
  title: string;
  year: number | null;
  rating: number | null;
  watched_date: string | null;
  entry_type: EntryType;
  source: "csv" | "rss";
}

const MAX_ZIP_BYTES = 30 * 1024 * 1024; // 30 MB — exports are typically < 5 MB
const MAX_ROWS_PER_FILE = 50_000;

function toYear(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 1870 && n < 2100 ? n : null;
}

function toRating(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

function toDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function rowToFilm(
  row: Record<string, string>,
  entryType: EntryType,
  dateField: string | null
): FilmUpsert | null {
  const title = row["Name"];
  if (!title) return null;
  const year = toYear(row["Year"]);
  const slug = slugFromUrl(row["Letterboxd URI"]) ?? deriveSlug(title, year);
  return {
    film_slug: slug,
    title,
    year,
    rating: toRating(row["Rating"]),
    watched_date: dateField ? toDate(row[dateField]) : null,
    entry_type: entryType,
    source: "csv",
  };
}

/**
 * Parse a Letterboxd export ZIP into normalized film rows.
 * Reads diary.csv, watched.csv, ratings.csv and watchlist.csv when present.
 * The raw ZIP is never persisted — only the rows returned here are stored.
 */
export async function parseExportZip(
  buffer: Buffer
): Promise<{ films: FilmUpsert[]; summary: ImportSummary }> {
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new Error("ZIP is too large — expected a Letterboxd export under 30 MB");
  }

  const zip = await JSZip.loadAsync(buffer);
  const filesFound: string[] = [];
  const counts = { diaryEntries: 0, ratings: 0, watched: 0, watchlist: 0 };

  // Keyed by slug|date|type to dedupe within the ZIP itself.
  const filmMap = new Map<string, FilmUpsert>();

  const addFilm = (film: FilmUpsert | null) => {
    if (!film) return false;
    const key = `${film.film_slug}|${film.watched_date ?? ""}|${film.entry_type}`;
    const existing = filmMap.get(key);
    if (existing) {
      // Keep the richest row (prefer one with a rating).
      if (existing.rating === null && film.rating !== null) filmMap.set(key, film);
      return false;
    }
    filmMap.set(key, film);
    return true;
  };

  const readCsv = async (name: string): Promise<Record<string, string>[] | null> => {
    // Exports sometimes nest files in a folder — match by basename.
    const entry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.split("/").pop()?.toLowerCase() === name
    );
    if (!entry) return null;
    filesFound.push(name);
    const text = await entry.async("string");
    const rows = parseCsv(text);
    return rows.slice(0, MAX_ROWS_PER_FILE);
  };

  const diary = await readCsv("diary.csv");
  if (diary) {
    for (const row of diary) {
      if (addFilm(rowToFilm(row, "diary", "Watched Date"))) counts.diaryEntries++;
    }
  }

  const watched = await readCsv("watched.csv");
  if (watched) {
    for (const row of watched) {
      const film = rowToFilm(row, "watched", "Date");
      // Skip films already covered by a diary entry on the same date.
      if (addFilm(film)) counts.watched++;
    }
  }

  const ratings = await readCsv("ratings.csv");
  if (ratings) {
    for (const row of ratings) {
      if (addFilm(rowToFilm(row, "rating", null))) counts.ratings++;
    }
  }

  const watchlist = await readCsv("watchlist.csv");
  if (watchlist) {
    for (const row of watchlist) {
      if (addFilm(rowToFilm(row, "watchlist", null))) counts.watchlist++;
    }
  }

  if (filesFound.length === 0) {
    throw new Error(
      "No Letterboxd CSVs found in the ZIP. Upload the official export from letterboxd.com/user/exportdata"
    );
  }

  const films = [...filmMap.values()];
  return {
    films,
    summary: { filesFound, ...counts, totalUpserted: films.length },
  };
}
