import "server-only";

import { XMLParser } from "fast-xml-parser";

import { deriveSlug, slugFromUrl } from "@/lib/slug";
import type { FilmUpsert } from "@/lib/import";

const FETCH_TIMEOUT_MS = 10_000;

interface RssItem {
  title?: string;
  link?: string;
  "letterboxd:filmTitle"?: string;
  "letterboxd:filmYear"?: string | number;
  "letterboxd:memberRating"?: string | number;
  "letterboxd:watchedDate"?: string;
}

/**
 * Fetch and parse a Letterboxd RSS feed into film rows.
 * Server-only: avoids CORS and keeps all outbound requests off the client.
 * This uses the official per-user RSS feed — no HTML scraping.
 */
export async function fetchRssFilms(rssUrl: string): Promise<FilmUpsert[]> {
  const parsed = new URL(rssUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== "letterboxd.com") {
    throw new Error("RSS URL must be a letterboxd.com feed");
  }

  const res = await fetch(rssUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "LetterboxdNight/1.0 (personal library sync)" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed (${res.status}). Check the feed URL and that the account is public.`);
  }

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: true });
  const doc = parser.parse(xml);

  const rawItems = doc?.rss?.channel?.item;
  if (!rawItems) return [];
  const items: RssItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  const films: FilmUpsert[] = [];
  for (const item of items) {
    const filmTitle = item["letterboxd:filmTitle"];
    // Skip list items — only diary/watch entries carry a film title.
    if (!filmTitle) continue;

    const title = String(filmTitle);
    const yearRaw = Number(item["letterboxd:filmYear"]);
    const year = Number.isInteger(yearRaw) && yearRaw > 1870 ? yearRaw : null;
    const ratingRaw = Number(item["letterboxd:memberRating"]);
    const rating = Number.isFinite(ratingRaw) && ratingRaw >= 0 && ratingRaw <= 5 ? ratingRaw : null;
    const watchedDate =
      typeof item["letterboxd:watchedDate"] === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item["letterboxd:watchedDate"])
        ? item["letterboxd:watchedDate"]
        : null;
    const slug = slugFromUrl(item.link) ?? deriveSlug(title, year);

    films.push({
      film_slug: slug,
      title,
      year,
      rating,
      watched_date: watchedDate,
      entry_type: "rss",
      source: "rss",
    });
  }
  return films;
}
