"use client";

import { useEffect, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { PickCard } from "@/components/PickCard";
import { buzz } from "@/lib/haptics";
import { usePosters } from "@/lib/usePosters";
import type { Pick, RecommendResponse, TonightFilters } from "@/lib/types";

interface DayTheme {
  name: string;
  blurb: string;
  filters: TonightFilters;
}

// Monday-first weekly themes. Era rotates by ISO week so no two weeks match.
function themesForWeek(weekNumber: number): DayTheme[] {
  const eras = ["1990s", "1980s", "2000s", "1970s", "2010s", "pre1970", "2020s"] as const;
  const timeMachineEra = eras[weekNumber % eras.length];
  const base = {
    intensity: "medium" as const,
    runtimeCap: "any" as const,
    language: "any" as const,
    era: "any" as const,
    allowRewatches: false,
  };
  return [
    {
      name: "Short & Sweet Monday",
      blurb: "Ease into the week — under 1h 45m.",
      filters: { ...base, mood: "easy", runtimeCap: "under105" },
    },
    {
      name: "Time Machine Tuesday",
      blurb: `This week's destination: the ${timeMachineEra === "pre1970" ? "pre-1970s" : timeMachineEra}.`,
      filters: { ...base, mood: "easy", era: timeMachineEra },
    },
    {
      name: "Weird Wednesday",
      blurb: "Something strange in the middle of the week.",
      filters: { ...base, mood: "weird" },
    },
    {
      name: "Throwback Thursday",
      blurb: "A stone-cold classic.",
      filters: { ...base, mood: "classic" },
    },
    {
      name: "Fright Friday",
      blurb: "Horror or a thriller — earn the weekend.",
      filters: { ...base, mood: "horror", intensity: "heavy" },
    },
    {
      name: "Big Night Saturday",
      blurb: "Action, spectacle, no runtime limit.",
      filters: { ...base, mood: "action" },
    },
    {
      name: "Comfort Sunday",
      blurb: "Feel-good to close the week.",
      filters: { ...base, mood: "feelgood", intensity: "light" },
    },
  ];
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STORE_KEY = "lbnight-gauntlet";

export function GauntletClient() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [todayPick, setTodayPick] = useState<Pick | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const weekday = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekday);
  const weekNumber = Math.floor(monday.getTime() / (7 * 86_400_000));
  const themes = themesForWeek(weekNumber);
  const todayTheme = themes[weekday];

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}"));
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: todayTheme.filters, count: 1 }),
    })
      .then((r) => r.json())
      .then((json: RecommendResponse) => {
        if (!cancelled) setTodayPick(json.picks?.[0] ?? null);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const posters = usePosters(
    todayPick ? [{ slug: todayPick.slug, title: todayPick.title, year: todayPick.year }] : []
  );

  function toggleToday() {
    const key = isoDate(now);
    const next = { ...done, [key]: !done[key] };
    if (next[key]) buzz([15, 30, 15]);
    setDone(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {}
  }

  // Streak: consecutive completed days ending today (or yesterday).
  let streak = 0;
  const cursor = new Date(now);
  if (!done[isoDate(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (done[isoDate(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return (
    <div className="min-h-screen">
      <AppNav active="gauntlet" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="animate-fade-up text-2xl font-bold text-white">The Gauntlet</h1>
            <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
              A themed film every day. How long can you keep the run alive?
            </p>
          </div>
          <div className="animate-pop-in rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-center">
            <p className="text-2xl font-black text-accent">{streak}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-night-400">
              day streak
            </p>
          </div>
        </div>

        {/* Week strip */}
        <div className="animate-fade-up mt-6 grid grid-cols-7 gap-1.5" style={{ animationDelay: "120ms" }}>
          {themes.map((t, i) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            const key = isoDate(day);
            const isToday = i === weekday;
            const completed = Boolean(done[key]);
            const past = i < weekday;
            return (
              <div
                key={t.name}
                className={`rounded-lg border p-1.5 text-center ${
                  isToday
                    ? "border-accent bg-accent/10"
                    : completed
                      ? "border-accent/40 bg-night-900"
                      : "border-night-700/60 bg-night-900"
                } ${past && !completed ? "opacity-50" : ""}`}
              >
                <p className="text-[10px] font-bold uppercase text-night-400">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                </p>
                <p className={`mt-1 text-lg ${completed ? "text-accent" : "text-night-700"}`}>
                  {completed ? "✓" : "·"}
                </p>
              </div>
            );
          })}
        </div>

        {/* Today's challenge */}
        <section className="card animate-fade-up mt-6" style={{ animationDelay: "180ms" }}>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Today&apos;s challenge
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{todayTheme.name}</h2>
          <p className="text-sm text-night-400">{todayTheme.blurb}</p>

          <div className="mt-4">
            {loading ? (
              <div className="mx-auto w-40">
                <div className="aspect-[2/3] animate-pulse rounded-lg bg-night-800" />
              </div>
            ) : todayPick ? (
              <div className="mx-auto max-w-[200px]">
                <PickCard pick={todayPick} posterUrl={posters[todayPick.slug]} />
              </div>
            ) : (
              <p className="text-center text-sm text-night-400">
                No match in your library for today&apos;s theme — pick your own film that fits and
                still claim the day.
              </p>
            )}
          </div>

          <button
            className={`${done[isoDate(now)] ? "btn-secondary" : "btn-primary"} mt-4 w-full`}
            onClick={toggleToday}
          >
            {done[isoDate(now)] ? "Completed — tap to undo" : "I watched it — claim today"}
          </button>
        </section>

        {/* The week ahead */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "240ms" }}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-400">
            This week
          </h2>
          <ul className="space-y-1.5">
            {themes.map((t, i) => (
              <li
                key={t.name}
                className={`flex items-baseline justify-between rounded-lg px-3 py-2 text-sm ${
                  i === weekday ? "bg-accent/10 text-white" : "text-slate-300"
                }`}
              >
                <span className="font-semibold">{t.name}</span>
                <span className="ml-3 text-right text-xs text-night-400">{t.blurb}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
