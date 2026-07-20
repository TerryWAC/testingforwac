"use client";

import { useEffect, useRef, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { PickSkeleton } from "@/components/PickSkeleton";
import { Confetti } from "@/components/Confetti";
import { PickCard } from "@/components/PickCard";
import { buzz } from "@/lib/haptics";
import { addRecentPicks, getRecentPicks } from "@/lib/recentPicks";
import { usePosters } from "@/lib/usePosters";
import type { Era, Mood, Pick, RecommendResponse, RuntimeCap } from "@/lib/types";

interface ReelDef<T> {
  name: string;
  values: { value: T; label: string }[];
}

const MOOD_REEL: ReelDef<Mood> = {
  name: "Mood",
  values: [
    { value: "comedy", label: "Comedy" },
    { value: "date", label: "Date night" },
    { value: "thriller", label: "Thriller" },
    { value: "horror", label: "Horror" },
    { value: "action", label: "Action" },
    { value: "romance", label: "Romance" },
    { value: "weird", label: "Weird" },
    { value: "mindbender", label: "Mind-bender" },
    { value: "feelgood", label: "Feel-good" },
    { value: "tearjerker", label: "Tearjerker" },
    { value: "classic", label: "Classic" },
    { value: "easy", label: "Easy watch" },
  ],
};
const ERA_REEL: ReelDef<Era> = {
  name: "Era",
  values: [
    { value: "2020s", label: "2020s" },
    { value: "2010s", label: "2010s" },
    { value: "2000s", label: "2000s" },
    { value: "1990s", label: "1990s" },
    { value: "1980s", label: "1980s" },
    { value: "1970s", label: "1970s" },
    { value: "pre1970", label: "Pre-1970" },
    { value: "any", label: "Any era" },
  ],
};
const RUNTIME_REEL: ReelDef<RuntimeCap> = {
  name: "Runtime",
  values: [
    { value: "under90", label: "Under 1h 30m" },
    { value: "under105", label: "Under 1h 45m" },
    { value: "under120", label: "Under 2h" },
    { value: "under150", label: "Under 2h 30m" },
    { value: "any", label: "Any length" },
  ],
};

const SPIN_MS = 70; // reel tick speed
const LOCK_DELAYS = [1100, 1900, 2700]; // when each reel locks

export function SlotsClient() {
  const [indices, setIndices] = useState([0, 0, 0]);
  const [locked, setLocked] = useState([true, true, true]);
  const [spinning, setSpinning] = useState(false);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [pickSource, setPickSource] = useState<"ai" | "deterministic" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const timers = useRef<number[]>([]);
  // Interval callbacks would see stale state — track locks in a ref too.
  const lockedRef = useRef([true, true, true]);

  const posters = usePosters(
    (picks ?? []).map((p) => ({ slug: p.slug, title: p.title, year: p.year }))
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function pull() {
    if (spinning || fetching) return;
    setPicks(null);
    setError(null);
    setSpinning(true);
    lockedRef.current = [false, false, false];
    setLocked([false, false, false]);

    const finals = [
      Math.floor(Math.random() * MOOD_REEL.values.length),
      Math.floor(Math.random() * ERA_REEL.values.length),
      Math.floor(Math.random() * RUNTIME_REEL.values.length),
    ];

    // Rapid cycling while unlocked.
    const interval = window.setInterval(() => {
      setIndices((prev) =>
        prev.map((v, i) =>
          lockedRef.current[i]
            ? v
            : Math.floor(Math.random() * [MOOD_REEL, ERA_REEL, RUNTIME_REEL][i].values.length)
        )
      );
    }, SPIN_MS);
    timers.current.push(interval as unknown as number);

    // Lock reels one by one, left to right.
    LOCK_DELAYS.forEach((delay, i) => {
      const t = window.setTimeout(() => {
        lockedRef.current[i] = true;
        setLocked([...lockedRef.current]);
        buzz(12);
        setIndices((prev) => {
          const next = [...prev];
          next[i] = finals[i];
          return next;
        });
        if (i === 2) {
          clearInterval(interval);
          setSpinning(false);
          void deal(finals);
        }
      }, delay);
      timers.current.push(t as unknown as number);
    });
  }

  async function deal(finals: number[]) {
    setFetching(true);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            mood: MOOD_REEL.values[finals[0]].value,
            era: ERA_REEL.values[finals[1]].value,
            runtimeCap: RUNTIME_REEL.values[finals[2]].value,
            intensity: "medium",
            language: "any",
            allowRewatches: false,
          },
          count: 8,
          excludeSlugs: getRecentPicks(),
        }),
      });
      const json: RecommendResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not deal picks");
      setPicks(json.picks);
      setPickSource(json.source);
      addRecentPicks(json.picks.map((p) => p.slug));
      if (json.picks.length > 0) buzz([15, 30, 20]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setFetching(false);
    }
  }

  const reels = [MOOD_REEL, ERA_REEL, RUNTIME_REEL] as const;

  return (
    <div className="min-h-screen">
      <AppNav active="slots" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up text-2xl font-bold text-white">Lucky Slots</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Pull the lever — mood, era and runtime lock in one by one, then the picks deal
          themselves.
        </p>

        {/* Machine */}
        <div
          className="animate-fade-up mt-6 rounded-2xl border border-night-700/60 bg-gradient-to-b from-night-800 to-night-900 p-4 sm:p-6"
          style={{ animationDelay: "120ms" }}
        >
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {reels.map((reel, i) => (
              <div key={reel.name} className="text-center">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-night-400">
                  {reel.name}
                </p>
                <div
                  className={`flex h-20 items-center justify-center rounded-xl border-2 px-2 transition-all duration-200 sm:h-24 ${
                    locked[i] && !spinning && picks !== null
                      ? "border-accent bg-accent/10"
                      : locked[i]
                        ? "border-accent bg-accent/5"
                        : "border-night-700 bg-night-950"
                  } ${!locked[i] ? "animate-reel-jitter blur-[1px]" : ""}`}
                >
                  <span
                    className={`text-sm font-black leading-tight sm:text-base ${
                      locked[i] ? "animate-pop-in text-white" : "text-night-400"
                    }`}
                  >
                    {reel.values[indices[i]].label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn-primary mt-5 w-full py-4 text-base font-black tracking-widest"
            onClick={pull}
            disabled={spinning || fetching}
          >
            {spinning ? "SPINNING…" : fetching ? "DEALING…" : picks ? "PULL AGAIN" : "PULL"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {fetching && (
          <div className="mt-6">
            <PickSkeleton count={4} />
          </div>
        )}

        {picks !== null && (
          <section className="mt-6">
            {picks.length > 0 && <Confetti count={20} />}
            {picks.length === 0 ? (
              <div className="card text-center">
                <p className="font-semibold text-white">
                  No films in your library match that combo
                </p>
                <p className="mt-1 text-sm text-night-400">
                  The house wins this round — pull again!
                </p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs text-night-400">
                  {picks.length} {picks.length === 1 ? "match" : "matches"} for{" "}
                  <span className="text-accent">
                    {MOOD_REEL.values[indices[0]].label} × {ERA_REEL.values[indices[1]].label} ×{" "}
                    {RUNTIME_REEL.values[indices[2]].label}
                  </span>
                  {pickSource === "deterministic" && " · from your library stats"}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {picks.map((p, i) => (
                    <PickCard key={p.slug} pick={p} posterUrl={posters[p.slug]} index={i} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
