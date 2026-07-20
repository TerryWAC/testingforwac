"use client";

import { useCallback, useEffect, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Confetti } from "@/components/Confetti";
import { Poster } from "@/components/Poster";
import { Tilt } from "@/components/Tilt";
import { fetchCandidates, type CandidateItem, type CandidateSource } from "@/lib/candidatesCache";
import { buzz } from "@/lib/haptics";
import { usePosters } from "@/lib/usePosters";
import { letterboxdUrl } from "@/lib/types";

/**
 * Veto Draft — choosing by killing. Eight films on the table; players take
 * turns eliminating one each until a single film survives.
 */
export function VetoClient() {
  const [source, setSource] = useState<CandidateSource>("watchlist");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [pool, setPool] = useState<CandidateItem[]>([]);

  const [board, setBoard] = useState<CandidateItem[]>([]);
  const [vetoed, setVetoed] = useState<Set<string>>(new Set());
  const [turn, setTurn] = useState(0);

  const posters = usePosters(board);

  const startDraft = useCallback((candidates: CandidateItem[]) => {
    const size = candidates.length >= 8 ? 8 : candidates.length >= 6 ? 6 : 4;
    setBoard([...candidates].sort(() => Math.random() - 0.5).slice(0, size));
    setVetoed(new Set());
    setTurn(0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCandidates(source, allowRewatches, 40)
      .then((candidates) => {
        if (cancelled) return;
        setPool(candidates);
        if (candidates.length >= 4) startDraft(candidates);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, allowRewatches, startDraft, retryTick]);

  const remaining = board.filter((f) => !vetoed.has(f.slug));
  const survivor = remaining.length === 1 ? remaining[0] : null;

  function veto(film: CandidateItem) {
    if (vetoed.has(film.slug) || survivor) return;
    buzz(12);
    const next = new Set(vetoed);
    next.add(film.slug);
    setVetoed(next);
    setTurn((t) => t + 1);
    if (board.length - next.size === 1) buzz([20, 40, 30]);
  }

  return (
    <div className="min-h-screen">
      <AppNav active="veto" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up text-2xl font-bold text-white">Veto Draft</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Choosing by killing: take turns striking films off the board. The last one standing is
          tonight&apos;s film.
        </p>

        <div className="animate-fade-up mt-4 flex flex-wrap items-center gap-2" style={{ animationDelay: "120ms" }}>
          <button
            className={`chip ${source === "watchlist" ? "chip-active" : ""}`}
            onClick={() => setSource("watchlist")}
          >
            Watchlist
          </button>
          <button
            className={`chip ${source === "all" ? "chip-active" : ""}`}
            onClick={() => setSource("all")}
          >
            Whole library
          </button>
          <button
            className={`chip ${source === "classics" ? "chip-active" : ""}`}
            onClick={() => setSource("classics")}
          >
            Classics
          </button>
          <label className="chip flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={allowRewatches}
              onChange={(e) => setAllowRewatches(e.target.checked)}
              className="h-3 w-3 accent-[#00c030]"
            />
            Rewatches
          </label>
          {!loading && pool.length >= 4 && (
            <button className="chip ml-auto" onClick={() => startDraft(pool)}>
              New board
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">
            {error}{" "}
            <button
              className="ml-1 font-semibold underline hover:text-white"
              onClick={() => setRetryTick((t) => t + 1)}
            >
              Retry
            </button>
          </p>
        )}

        {loading ? (
          <p className="mt-10 text-center text-sm text-night-400">Setting the board…</p>
        ) : pool.length < 4 ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-white">Not enough films for a draft</p>
            <p className="mt-1 text-sm text-night-400">
              Try the whole library, allow rewatches, or the Classics source.
            </p>
          </div>
        ) : survivor ? (
          <div className="animate-pop-in mt-8 text-center">
            <Confetti />
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-accent">
              Last film standing
            </p>
            <Tilt max={12} className="mx-auto mt-4 w-52 sm:w-60">
              <div className="animate-float">
                <div className="animate-glow overflow-hidden rounded-xl">
                  <Poster title={survivor.title} year={survivor.year} url={posters[survivor.slug]} />
                </div>
              </div>
            </Tilt>
            <p className="mt-4 text-2xl font-bold text-white">
              {survivor.title}
              {survivor.year && (
                <span className="ml-2 text-lg font-medium text-night-400">{survivor.year}</span>
              )}
            </p>
            <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2.5">
              <a
                href={letterboxdUrl(survivor)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full"
              >
                View on Letterboxd
              </a>
              <button className="btn-secondary w-full" onClick={() => startDraft(pool)}>
                New draft
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm font-bold text-white">
                Player {(turn % 2) + 1}&apos;s veto
              </p>
              <p className="text-xs text-night-400">{remaining.length} films left</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {board.map((film, i) => {
                const dead = vetoed.has(film.slug);
                return (
                  <button
                    key={film.slug}
                    className={`animate-fade-up group text-left transition-all duration-300 ${
                      dead ? "pointer-events-none scale-95 opacity-30 grayscale" : ""
                    }`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => veto(film)}
                    aria-label={dead ? `${film.title} vetoed` : `Veto ${film.title}`}
                  >
                    <Tilt>
                      <div className="relative overflow-hidden rounded-lg border-2 border-transparent transition-colors group-hover:border-red-400">
                        <Poster title={film.title} year={film.year} url={posters[film.slug]} />
                        {dead && (
                          <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-red-400">
                            ✕
                          </span>
                        )}
                      </div>
                    </Tilt>
                    <p className="mt-1.5 text-center text-xs font-bold leading-tight text-white">
                      {film.title}
                      {film.year && (
                        <span className="ml-1 font-medium text-night-400">{film.year}</span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs text-night-400">
              Tap a film to strike it from the board — pass the phone after each veto.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
