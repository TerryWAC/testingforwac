"use client";

import { useCallback, useEffect, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { FilmInfoSheet } from "@/components/FilmInfoSheet";
import { Poster } from "@/components/Poster";
import { Tilt } from "@/components/Tilt";
import { fetchCandidates, type CandidateItem, type CandidateSource } from "@/lib/candidatesCache";
import { usePosters } from "@/lib/usePosters";
import { letterboxdUrl } from "@/lib/types";

/**
 * Final Cut — a knockout tournament for your own library. Eight films enter,
 * you judge every head-to-head, one leaves as tonight's champion. Built for
 * couples: pass the phone between rounds.
 */
export function FaceOffClient() {
  const [source, setSource] = useState<CandidateSource>("watchlist");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pool, setPool] = useState<CandidateItem[]>([]);

  const [contenders, setContenders] = useState<CandidateItem[]>([]);
  const [survivors, setSurvivors] = useState<CandidateItem[]>([]);
  const [pairIndex, setPairIndex] = useState(0);
  const [champion, setChampion] = useState<CandidateItem | null>(null);
  const [matchKey, setMatchKey] = useState(0); // remount animation per match
  const [showInfo, setShowInfo] = useState(false);

  const posters = usePosters(pool);

  const startBracket = useCallback((candidates: CandidateItem[]) => {
    const size = candidates.length >= 8 ? 8 : candidates.length >= 4 ? 4 : 2;
    const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, size);
    setContenders(shuffled);
    setSurvivors([]);
    setPairIndex(0);
    setChampion(null);
    setMatchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChampion(null);
    fetchCandidates(source, allowRewatches, 40)
      .then((candidates) => {
        if (cancelled) return;
        setPool(candidates);
        if (candidates.length >= 2) startBracket(candidates);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, allowRewatches, startBracket]);

  function choose(winner: CandidateItem) {
    const nextSurvivors = [...survivors, winner];
    const nextPair = pairIndex + 1;

    if (nextPair * 2 >= contenders.length) {
      // Round complete.
      if (nextSurvivors.length === 1) {
        setChampion(nextSurvivors[0]);
        return;
      }
      setContenders(nextSurvivors);
      setSurvivors([]);
      setPairIndex(0);
    } else {
      setSurvivors(nextSurvivors);
      setPairIndex(nextPair);
    }
    setMatchKey((k) => k + 1);
  }

  const left = contenders[pairIndex * 2];
  const right = contenders[pairIndex * 2 + 1];
  const roundName =
    contenders.length === 8 ? "Quarter-finals" : contenders.length === 4 ? "Semi-finals" : "The Final";
  const totalPairs = Math.floor(contenders.length / 2);

  return (
    <div className="min-h-screen">
      <AppNav active="faceoff" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up text-2xl font-bold text-white">Final Cut</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Eight films enter, one leaves. Tap the film you&apos;d rather watch in each face-off —
          pass the phone between rounds if you&apos;re deciding together.
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
          {!loading && pool.length >= 2 && !champion && (
            <button className="chip ml-auto" onClick={() => startBracket(pool)}>
              Restart bracket
            </button>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="mt-10 text-center text-sm text-night-400">Seeding the bracket…</p>
        ) : pool.length < 2 ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-white">Not enough films for a tournament</p>
            <p className="mt-1 text-sm text-night-400">
              Try the whole library, allow rewatches, or add more films to your watchlist.
            </p>
          </div>
        ) : champion ? (
          <div className="animate-pop-in mt-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-accent">
              Tonight&apos;s champion
            </p>
            <Tilt max={12} className="mx-auto mt-4 w-52 sm:w-60">
              <div className="animate-float">
                <div className="animate-glow overflow-hidden rounded-xl">
                  <Poster
                    title={champion.title}
                    year={champion.year}
                    url={posters[champion.slug]}
                  />
                </div>
              </div>
            </Tilt>
            <p className="mt-4 text-2xl font-bold text-white">
              {champion.title}
              {champion.year && (
                <span className="ml-2 text-lg font-medium text-night-400">{champion.year}</span>
              )}
            </p>
            {champion.reasons[0] && (
              <p className="mt-1.5 text-sm text-slate-300">{champion.reasons[0]}</p>
            )}
            <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2.5">
              <a
                href={letterboxdUrl(champion)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full"
              >
                View on Letterboxd
              </a>
              <button className="btn-secondary w-full" onClick={() => setShowInfo(true)}>
                More info
              </button>
              <button className="btn-secondary w-full" onClick={() => startBracket(pool)}>
                Run it back
              </button>
            </div>
          </div>
        ) : left && right ? (
          <>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm font-bold text-white">{roundName}</p>
              <p className="text-xs text-night-400">
                Match {pairIndex + 1} of {totalPairs}
              </p>
            </div>
            {/* Progress dots */}
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: totalPairs }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i < pairIndex ? "bg-accent" : i === pairIndex ? "bg-accent/50" : "bg-night-700"}`}
                />
              ))}
            </div>

            <div key={matchKey} className="animate-fade-up mt-5 grid grid-cols-2 gap-3 sm:gap-6">
              {[left, right].map((film, side) => (
                <button
                  key={film.slug}
                  className="group text-left"
                  onClick={() => choose(film)}
                  aria-label={`Choose ${film.title}`}
                >
                  <Tilt>
                    <div className="overflow-hidden rounded-xl border-2 border-transparent transition-colors group-hover:border-accent group-active:border-accent">
                      <Poster title={film.title} year={film.year} url={posters[film.slug]} />
                    </div>
                  </Tilt>
                  <p className="mt-2 text-center text-sm font-bold leading-tight text-white group-hover:text-accent">
                    {film.title}
                    {film.year && (
                      <span className="ml-1.5 font-medium text-night-400">{film.year}</span>
                    )}
                  </p>
                  {film.reasons[0] && (
                    <p className="mt-0.5 text-center text-xs text-night-400">{film.reasons[0]}</p>
                  )}
                  {side === 0 && (
                    <span className="sr-only">versus</span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs font-black uppercase tracking-[0.3em] text-night-400">
              VS
            </p>
          </>
        ) : null}
      </main>

      {champion && showInfo && (
        <FilmInfoSheet
          target={{ ...champion, posterUrl: posters[champion.slug], why: champion.reasons[0] }}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
}
