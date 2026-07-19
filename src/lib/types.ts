// Shared domain types for Letterboxd Night.

export type Mood = "comedy" | "date" | "thriller" | "weird" | "easy";
export type Intensity = "light" | "medium" | "heavy";
export type RuntimeCap = "under90" | "under120" | "any";
export type LanguagePref = "english" | "any";
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
  allowRewatches: boolean;
}

export interface Pick {
  title: string;
  year: number | null;
  slug: string;
  why: string;
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
export const LETTERBOXD_RSS_URL = (username: string) =>
  `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;
