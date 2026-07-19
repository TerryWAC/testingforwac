"use client";

import { useEffect, useRef, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { LETTERBOXD_FILM_URL } from "@/lib/types";

interface WheelItem {
  slug: string;
  title: string;
  year: number | null;
  reasons: string[];
}

const CARD_W = 140; // px
const GAP = 12; // px
const LOOPS = 5; // how many times the pool repeats in the reel

export function WheelClient() {
  const [pool, setPool] = useState<WheelItem[]>([]);
  const [source, setSource] = useState<"watchlist" | "all">("watchlist");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [offset, setOffset] = useState(0);
  const [duration, setDuration] = useState(0);
  const reelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWinner(null);
    setOffset(0);
    fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, allowRewatches, limit: 40 }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setPool(json.candidates ?? []);
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
    setSpinning(true);

    const winnerIndex = Math.floor(Math.random() * pool.length);
    // Land in the second-to-last loop so there's always reel on both sides.
    const targetIndex = (LOOPS - 2) * pool.length + winnerIndex;
    const container = reelRef.current?.parentElement;
    const containerW = container?.clientWidth ?? 360;
    const itemW = CARD_W + GAP;
    const target = targetIndex * itemW + CARD_W / 2 - containerW / 2;

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
        }, spinDuration * 1000 + 100);
      });
    });
  }

  const reel = Array.from({ length: LOOPS }, () => pool).flat();

  return (
    <div className="min-h-screen">
      <AppNav active="wheel" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-white">Spin the Wheel</h1>
        <p className="mt-1 text-sm text-night-400">
          Can&apos;t decide? Let the reel pick from your own library. Respin as much as you like.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
                ? "Your watchlist looks empty — try “Whole library” with rewatches on, or add films to your Letterboxd watchlist and sync."
                : "Try enabling rewatches, or import/sync more films."}
            </p>
          </div>
        ) : (
          <>
            {/* Reel */}
            <div className="relative mt-8 overflow-hidden rounded-xl border border-night-700/60 bg-night-900 py-6">
              {/* Center marker */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[148px] -translate-x-1/2 rounded-lg border-2 border-accent bg-accent/5" />
              <div
                ref={reelRef}
                className="flex"
                style={{
                  gap: `${GAP}px`,
                  transform: `translateX(-${offset}px)`,
                  transition: offset === 0 ? "none" : `transform ${duration}s cubic-bezier(0.15, 0.85, 0.25, 1)`,
                }}
              >
                {reel.map((item, i) => (
                  <div
                    key={`${item.slug}-${i}`}
                    className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-night-800 to-night-700 px-2 py-4 text-center"
                    style={{ width: `${CARD_W}px`, height: "180px" }}
                  >
                    <span className="text-sm font-bold leading-tight text-slate-200">
                      {item.title}
                    </span>
                    {item.year && <span className="mt-1 text-xs text-night-400">{item.year}</span>}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn-primary mt-6 w-full text-base"
              onClick={spin}
              disabled={spinning}
            >
              {spinning ? "Spinning…" : winner ? "Spin again" : "Spin"}
            </button>

            {winner && (
              <div className="card mt-6 border-accent/40 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-accent">
                  Tonight&apos;s film
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {winner.title}
                  {winner.year && (
                    <span className="ml-2 text-lg font-medium text-night-400">{winner.year}</span>
                  )}
                </p>
                {winner.reasons.length > 0 && (
                  <p className="mt-2 text-sm text-slate-300">{winner.reasons[0]}</p>
                )}
                <a
                  href={LETTERBOXD_FILM_URL(winner.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary mt-4 inline-flex"
                >
                  View on Letterboxd →
                </a>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
