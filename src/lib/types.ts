// Shared domain types for Letterboxd Night.

export type Mood =
  | "comedy"
  | "date"
  | "thriller"
  | "horror"
  | "action"
  | "romance"
  | "weird"
  | "mindbender"
  | "feelgood"
  | "tearjerker"
  | "classic"
  | "easy";
export type Intensity = "light" | "medium" | "heavy" | "extreme";
export type RuntimeCap = "under90" | "under105" | "under120" | "under150" | "any";
export type LanguagePref = "english" | "foreign" | "any";
export type Era =
  | "any"
  | "2020s"
  | "2010s"
  | "2000s"
  | "1990s"
  | "1980s"
  | "1970s"
  | "pre1970";
export type EntryType = "diary" | "watched" | "rating" | "watchlist" | "rss";

export interface Profile {
  id: string;
  user_id: string | null;
  letterboxd_username: string;
  rss_url: string;
  is_guest: boolean;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface FilmRow {
  id: string;
  profile_id: string;
  film_slug: string;
  title: string;
  year: number | null;
  rating: number | null;
  watched_date: string | null;
  entry_type: EntryType;
  source: "csv" | "rss";
  created_at: string;
  updated_at: string;
}

export interface Preferences {
  profile_id: string;
  default_mood: Mood;
  default_intensity: Intensity;
  default_runtime_cap: RuntimeCap;
  allow_rewatches: boolean;
  language_pref: LanguagePref;
}

export interface TonightFilters {
  mood: Mood;
  intensity: Intensity;
  runtimeCap: RuntimeCap;
  language: LanguagePref;
  era: Era;
  allowRewatches: boolean;
}

export interface Pick {
  title: string;
  year: number | null;
  slug: string;
  why: string;
  discovery?: boolean;
}

export interface RecommendResponse {
  picks: Pick[];
  source: "ai" | "deterministic";
  followUp?: string;
}

export interface TasteSnapshot {
  totalFilms: number;
  totalRated: number;
  averageRating: number | null;
  topDecades: { decade: string; count: number }[];
  topRated: { title: string; year: number | null; slug: string; rating: number }[];
  recentWatches: { title: string; year: number | null; slug: string; watched_date: string | null }[];
  mostWatchedYear: { year: number; count: number } | null;
  watchlistCount: number;
}

export interface ImportSummary {
  filesFound: string[];
  diaryEntries: number;
  ratings: number;
  watched: number;
  watchlist: number;
  totalUpserted: number;
}

export const LETTERBOXD_FILM_URL = (slug: string) => `https://letterboxd.com/film/${slug}/`;
export const LETTERBOXD_SEARCH_URL = (title: string) =>
  `https://letterboxd.com/search/films/${encodeURIComponent(title)}/`;
export const LETTERBOXD_RSS_URL = (username: string) =>
  `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;

/**
 * Discovery picks come from the curated catalog, where exact Letterboxd
 * slugs aren't known — link through search so it never 404s.
 */
export const letterboxdUrl = (item: { slug: string; title: string; discovery?: boolean }) =>
  item.discovery ? LETTERBOXD_SEARCH_URL(item.title) : LETTERBOXD_FILM_URL(item.slug);
