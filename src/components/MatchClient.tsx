"use client";

import { useEffect, useRef, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Poster } from "@/components/Poster";
import { fetchCandidates, type CandidateSource } from "@/lib/candidatesCache";
import { usePosters } from "@/lib/usePosters";
import { letterboxdUrl } from "@/lib/types";

interface MatchItem {
  slug: string;
  title: string;
  year: number | null;
  reasons: string[];
  discovery?: boolean;
}

const SAVED_KEY = "lbnight-match-saved";
const SWIPE_THRESHOLD = 90; // px

export function MatchClient() {
  const [deck, setDeck] = useState<MatchItem[]>([]);
  const [saved, setSaved] = useState<MatchItem[]>([]);
  const [source, setSource] = useState<CandidateSource>("watchlist");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [exiting, setExiting] = useState<"left" | "right" | "up" | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_KEY);
      if (stored) setSaved(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCandidates(source, allowRewatches, 40)
      .then((candidates) => {
        if (!cancelled) setDeck(candidates);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, allowRewatches]);

  const top = deck[0] ?? null;
  const posters = usePosters([...deck.slice(0, 10), ...saved.slice(0, 20)]);
  const topPoster = top ? posters[top.slug] : undefined;

  function persistSaved(next: MatchItem[]) {
    setSaved(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {}
  }

  function decide(verdict: "no" | "maybe" | "yes") {
    if (!top || exiting) return;
    setExiting(verdict === "no" ? "left" : verdict === "yes" ? "right" : "up");
    window.setTimeout(() => {
      if (verdict === "yes" && !saved.some((s) => s.slug === top.slug)) {
        persistSaved([top, ...saved]);
      }
      if (verdict === "maybe") {
        // Move to the back of the deck for another look later.
        setDeck((d) => [...d.slice(1), d[0]]);
      } else {
        setDeck((d) => d.slice(1));
      }
      setExiting(null);
      setDrag(null);
    }, 250);
  }

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    setDrag({ dx: e.clientX - dragStart.current.x, dy: e.clientY - dragStart.current.y });
  }
  function onPointerUp() {
    if (!dragStart.current) return;
    const d = drag;
    dragStart.current = null;
    if (!d) return;
    if (d.dx < -SWIPE_THRESHOLD) decide("no");
    else if (d.dx > SWIPE_THRESHOLD) decide("yes");
    else if (d.dy < -SWIPE_THRESHOLD) decide("maybe");
    else setDrag(null);
  }

  const cardTransform = exiting
    ? exiting === "left"
      ? "translateX(-120vw) rotate(-20deg)"
      : exiting === "right"
        ? "translateX(120vw) rotate(20deg)"
        : "translateY(-120vh)"
    : drag
      ? `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 20}deg)`
      : "none";

  return (
    <div className="min-h-screen">
      <AppNav active="match" />
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="text-2xl font-bold text-white">Movie Match</h1>
        <p className="mt-1 text-sm text-night-400">
          Swipe right to save, left to pass, up for maybe — or use the buttons.
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

        {/* Card stack */}
        <div className="relative mt-6 h-[440px] select-none sm:h-[500px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-night-400">
              Dealing the deck…
            </div>
          ) : !top ? (
            <div className="card flex h-full flex-col items-center justify-center text-center">
              <p className="font-semibold text-white">Deck&apos;s empty</p>
              <p className="mt-1 text-sm text-night-400">
                Switch source, allow rewatches, or log more films on Letterboxd — they arrive
                here automatically.
              </p>
            </div>
          ) : (
            <>
              {deck[1] && (
                <div className="absolute inset-0 scale-95 rounded-xl border border-night-700/60 bg-night-900" />
              )}
              <div
                key={top.slug}
                className="animate-overlay-in absolute inset-0 flex cursor-grab touch-none flex-col overflow-hidden rounded-xl border border-night-700/60 bg-night-900 active:cursor-grabbing"
                style={{
                  transform: cardTransform,
                  transition: exiting ? "transform 0.25s ease-in" : drag ? "none" : "transform 0.2s",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {/* Full-bleed poster with readable gradient */}
                {topPoster ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${topPoster})` }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-night-800 to-night-900 pb-32">
                    <span className="px-8 text-center text-3xl font-black uppercase leading-tight tracking-wide text-slate-300">
                      {top.title}
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-5 pb-5 pt-16">
                  <p className="text-2xl font-bold leading-tight text-white drop-shadow">
                    {top.title}
                    {top.year && (
                      <span className="ml-2 text-base font-medium text-slate-300">{top.year}</span>
                    )}
                  </p>
                  {top.reasons.length > 0 && (
                    <p className="mt-1.5 text-sm text-slate-200">{top.reasons[0]}</p>
                  )}
                  <a
                    href={letterboxdUrl(top)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    View on Letterboxd →
                  </a>
                </div>
                {drag && Math.abs(drag.dx) > 30 && (
                  <span
                    className={`absolute top-6 rounded-lg border-2 px-3 py-1 text-lg font-black uppercase ${
                      drag.dx > 0
                        ? "left-6 rotate-[-12deg] border-accent text-accent"
                        : "right-6 rotate-[12deg] border-red-400 text-red-400"
                    }`}
                  >
                    {drag.dx > 0 ? "Yes" : "No"}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        {top && !loading && (
          <div className="mt-5 flex justify-center gap-3">
            <button
              className="btn flex-1 max-w-32 rounded-full border border-red-400/40 bg-night-800 py-3 font-bold text-red-400 transition-transform hover:bg-red-400/10 active:scale-95"
              onClick={() => decide("no")}
            >
              No
            </button>
            <button
              className="btn flex-1 max-w-32 rounded-full border border-accent-blue/40 bg-night-800 py-3 font-bold text-accent-blue transition-transform hover:bg-accent-blue/10 active:scale-95"
              onClick={() => decide("maybe")}
            >
              Maybe
            </button>
            <button
              className="btn flex-1 max-w-32 rounded-full border border-accent/40 bg-night-800 py-3 font-bold text-accent transition-transform hover:bg-accent/10 active:scale-95"
              onClick={() => decide("yes")}
            >
              Yes
            </button>
          </div>
        )}

        {/* Saved list */}
        {saved.length > 0 && (
          <section className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-night-400">
                Saved ({saved.length})
              </h2>
              <button
                className="text-xs text-night-400 hover:text-red-400"
                onClick={() => persistSaved([])}
              >
                Clear
              </button>
            </div>
            <ul className="space-y-1.5">
              {saved.map((s) => (
                <li key={s.slug} className="card flex items-center gap-3 py-2">
                  <div className="w-9 shrink-0">
                    <Poster title={s.title} year={s.year} url={posters[s.slug]} />
                  </div>
                  <span className="flex-1 text-sm text-slate-200">
                    {s.title} {s.year && <span className="text-night-400">({s.year})</span>}
                  </span>
                  <a
                    href={letterboxdUrl(s)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Letterboxd →
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
