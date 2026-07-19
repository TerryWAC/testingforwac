"use client";

import { useEffect, useState } from "react";

import { Poster } from "@/components/Poster";
import { letterboxdUrl } from "@/lib/types";

export interface FilmInfoTarget {
  slug: string;
  title: string;
  year: number | null;
  discovery?: boolean;
  why?: string;
  posterUrl?: string | null;
}

interface FilmInfo {
  inLibrary: boolean;
  rating: number | null;
  watchDates: string[];
  timesWatched: number;
  onWatchlist: boolean;
  review: string | null;
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="text-accent" aria-label={`${rating} out of 5`}>
      {"★".repeat(full)}
      {half && "½"}
      <span className="text-night-700">{"★".repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}</span>
    </span>
  );
}

/**
 * Bottom sheet (mobile) / centered dialog (desktop) with everything the app
 * knows about a film — your rating, watches, review — plus the Letterboxd
 * hand-off. Anything logged there flows back on the next refresh.
 */
export function FilmInfoSheet({
  target,
  onClose,
}: {
  target: FilmInfoTarget;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<FilmInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/film-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: target.slug }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && !json.error) setInfo(json);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [target.slug]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-overlay-in absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-sheet-in relative w-full max-w-md rounded-t-2xl border border-night-700/60 bg-night-900 p-5 sm:rounded-2xl">
        {/* Grab handle on mobile */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-night-700 sm:hidden" />

        <div className="flex gap-4">
          <div className="w-24 shrink-0 sm:w-28">
            <Poster title={target.title} year={target.year} url={target.posterUrl} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight text-white">
              {target.title}
              {target.year && (
                <span className="ml-1.5 text-base font-medium text-night-400">{target.year}</span>
              )}
            </h2>
            {loading ? (
              <p className="mt-2 text-xs text-night-400">Checking your history…</p>
            ) : info?.inLibrary ? (
              <div className="mt-2 space-y-1 text-sm">
                {info.rating !== null && (
                  <p>
                    <Stars rating={info.rating} />{" "}
                    <span className="text-xs text-night-400">your rating</span>
                  </p>
                )}
                {info.timesWatched > 0 && (
                  <p className="text-xs text-night-400">
                    Watched {info.timesWatched} {info.timesWatched === 1 ? "time" : "times"}
                    {info.watchDates[0] && ` · last on ${info.watchDates[0]}`}
                  </p>
                )}
                {info.onWatchlist && info.timesWatched === 0 && (
                  <p className="text-xs text-accent">On your watchlist</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-night-400">
                Not in your library yet{target.discovery ? " — a discovery pick" : ""}.
              </p>
            )}
          </div>
        </div>

        {info?.review && (
          <blockquote className="mt-4 border-l-2 border-accent/60 pl-3 text-sm italic leading-relaxed text-slate-300">
            {info.review.length > 400 ? `${info.review.slice(0, 400)}…` : info.review}
            <span className="mt-1 block text-[11px] not-italic text-night-400">Your review</span>
          </blockquote>
        )}

        {target.why && <p className="mt-4 text-sm text-slate-300">{target.why}</p>}

        <div className="mt-5 space-y-2">
          <a
            href={letterboxdUrl(target)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary w-full"
          >
            Rate or review on Letterboxd
          </a>
          <p className="text-center text-[11px] leading-snug text-night-400">
            Anything you log there flows back into this app automatically.
          </p>
          <button className="btn-secondary w-full" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
