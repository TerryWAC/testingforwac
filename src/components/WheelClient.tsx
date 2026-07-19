"use client";

import { useEffect, useRef, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Poster } from "@/components/Poster";
import { Tilt } from "@/components/Tilt";
import { fetchCandidates, type CandidateSource } from "@/lib/candidatesCache";
import { usePosters } from "@/lib/usePosters";
import { letterboxdUrl } from "@/lib/types";

interface WheelItem {
  slug: string;
  title: string;
  year: number | null;
  reasons: string[];
  discovery?: boolean;
}

const GAP = 12; // px
const LOOPS = 5; // how many times the pool repeats in the reel

export function WheelClient() {
  const [pool, setPool] = useState<WheelItem[]>([]);
  const [source, setSource] = useState<CandidateSource>("watchlist");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [offset, setOffset] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cardW, setCardW] = useState(130);
  const reelRef = useRef<HTMLDivElement>(null);

  const posters = usePosters(pool);

  // Smaller reel cards on phones so the wheel fits without crowding.
  useEffect(() => {
    const update = () => setCardW(window.innerWidth < 640 ? 108 : 150);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWinner(null);
    setShowWinner(false);
    setOffset(0);
    fetchCandidates(source, allowRewatches, 40)
      .then((candidates) => {
        if (!cancelled) setPool(candidates);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, allowRewatches]);

  function spin() {
    if (pool.length < 2 || spinning) return;
    setWinner(null);
    setShowWinner(false);
    setSpinning(true);

    const winnerIndex = Math.floor(Math.random() * pool.length);
    // Land in the second-to-last loop so there's always reel on both sides.
    const targetIndex = (LOOPS - 2) * pool.length + winnerIndex;
    const container = reelRef.current?.parentElement;
    const containerW = container?.clientWidth ?? 360;
    const itemW = cardW + GAP;
    const target = targetIndex * itemW + cardW / 2 - containerW / 2;

    const spinDuration = 2.8 + Math.random() * 0.9; // 2.8-3.7s, always < 4s
    setDuration(spinDuration);
    // Force reflow so the transition restarts from 0 each spin.
    setOffset(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOffset(target);
        window.setTimeout(() => {
          setSpinning(false);
          setWinner(pool[winnerIndex]);
          window.setTimeout(() => setShowWinner(true), 350);
        }, spinDuration * 1000 + 100);
      });
    });
  }

  const reel = Array.from({ length: LOOPS }, () => pool).flat();
  const cardH = Math.round(cardW * 1.5);
  const winnerPoster = winner ? posters[winner.slug] : undefined;

  return (
    <div className="min-h-screen">
      <AppNav active="wheel" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up text-2xl font-bold text-white">Spin the Wheel</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Can&apos;t decide? Let the reel pick from your own library. Respin as much as you like.
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
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <div className="mt-10 text-center text-sm text-night-400">Loading your films…</div>
        ) : pool.length < 2 ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-white">Not enough films in this source</p>
            <p className="mt-1 text-sm text-night-400">
              {source === "watchlist"
                ? "Your watchlist looks empty — try “Whole library” with rewatches on, or add films to your Letterboxd watchlist and hit Refresh on the Tonight page."
                : "Try enabling rewatches, or import a fresh export from the menu."}
            </p>
          </div>
        ) : (
          <>
            {/* Reel */}
            <div
              className="animate-fade-up relative mt-8 overflow-hidden rounded-xl border border-night-700/60 bg-night-900 py-5"
              style={{ animationDelay: "180ms" }}
            >
              {/* Edge fades */}
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-night-900 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-night-900 to-transparent" />
              {/* Center marker */}
              <div
                className={`pointer-events-none absolute inset-y-2 left-1/2 z-10 -translate-x-1/2 rounded-xl border-2 border-accent bg-accent/5 ${spinning ? "animate-glow" : ""}`}
                style={{ width: `${cardW + 10}px` }}
              />
              <div
                ref={reelRef}
                className="flex"
                style={{
                  gap: `${GAP}px`,
                  transform: `translateX(-${offset}px)`,
                  transition:
                    offset === 0 ? "none" : `transform ${duration}s cubic-bezier(0.15, 0.85, 0.25, 1)`,
                }}
              >
                {reel.map((item, i) => (
                  <div key={`${item.slug}-${i}`} className="shrink-0" style={{ width: `${cardW}px`, height: `${cardH}px` }}>
                    <Poster title={item.title} year={item.year} url={posters[item.slug]} />
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn-primary animate-fade-up mt-6 w-full py-3.5 text-base"
              style={{ animationDelay: "240ms" }}
              onClick={spin}
              disabled={spinning}
            >
              {spinning ? "Spinning…" : winner ? "Spin again" : "Spin"}
            </button>
          </>
        )}
      </main>

      {/* Cinematic winner reveal */}
      {winner && showWinner && (
        <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center p-5">
          {/* Blurred poster backdrop */}
          <div className="absolute inset-0 bg-night-950/90 backdrop-blur-sm" onClick={() => setShowWinner(false)} />
          {winnerPoster && (
            <div
              className="absolute inset-0 opacity-25 blur-2xl"
              style={{
                backgroundImage: `url(${winnerPoster})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          <div className="animate-pop-in relative w-full max-w-xs text-center">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-accent">
              Tonight&apos;s film
            </p>
            <Tilt max={12} className="mx-auto mt-4 w-48 sm:w-56">
              <div className="animate-float">
                <div className="animate-glow overflow-hidden rounded-xl">
                  <Poster title={winner.title} year={winner.year} url={winnerPoster} />
                </div>
              </div>
            </Tilt>
            <p className="mt-4 text-2xl font-bold leading-tight text-white">
              {winner.title}
              {winner.year && (
                <span className="ml-2 text-lg font-medium text-night-400">{winner.year}</span>
              )}
            </p>
            {winner.reasons.length > 0 && (
              <p className="mt-2 text-sm text-slate-300">{winner.reasons[0]}</p>
            )}
            <div className="mt-5 flex flex-col gap-2.5">
              <a
                href={letterboxdUrl(winner)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full"
              >
                View on Letterboxd →
              </a>
              <button
                className="btn-secondary w-full"
                onClick={() => {
                  setShowWinner(false);
                  spin();
                }}
              >
                Spin again
              </button>
              <button
                className="text-xs text-night-400 hover:text-slate-300"
                onClick={() => setShowWinner(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
