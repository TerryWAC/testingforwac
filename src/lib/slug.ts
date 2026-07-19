/**
 * Extract a Letterboxd film slug from a film/diary URL, e.g.
 *   https://letterboxd.com/film/parasite-2019/          -> parasite-2019
 *   https://letterboxd.com/user/film/parasite-2019/1/   -> parasite-2019
 */
export function slugFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/letterboxd\.com\/(?:[^/]+\/)?film\/([^/]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/** Derive a safe slug from a title + year when no URL is available. */
export function deriveSlug(title: string, year?: number | null): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return year ? `${base}-${year}` : base || "unknown-film";
}
