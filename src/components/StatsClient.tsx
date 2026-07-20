"use client";

import { AppNav } from "@/components/AppNav";
import type { BuffProfile } from "@/lib/stats";

interface Props {
  heatmap: { date: string; count: number }[];
  histogram: number[];
  decades: { decade: string; count: number }[];
  streak: number;
  buff: BuffProfile;
}

const TIER_STYLE: Record<BuffProfile["tier"], string> = {
  S: "bg-accent text-night-950",
  A: "bg-accent/70 text-night-950",
  B: "bg-accent-blue/70 text-night-950",
  C: "bg-accent-orange/70 text-night-950",
  F: "bg-red-500/80 text-white",
};

function heatClass(count: number): string {
  if (count === 0) return "bg-night-800";
  if (count === 1) return "bg-accent/30";
  if (count === 2) return "bg-accent/60";
  return "bg-accent";
}

export function StatsClient({ heatmap, histogram, decades, streak, buff }: Props) {
  // Columns of 7 (Mon-Sun) for the heatmap.
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7));
  }
  const maxHist = Math.max(1, ...histogram);
  const maxDecade = Math.max(1, ...decades.map((d) => d.count));
  const totalDays = heatmap.filter((d) => d.count > 0).length;

  return (
    <div className="min-h-screen">
      <AppNav active="stats" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up title-grad text-2xl font-bold">Your Stats</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Your library, charted.
        </p>

        {/* Your build */}
        <section className="card animate-pop-in mt-6 bg-gradient-to-br from-accent/10 via-night-900 to-night-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-night-400">
                Your build
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                Level {buff.level} · {buff.title}
              </p>
            </div>
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-black ${TIER_STYLE[buff.tier]}`}
              title={`${buff.tier} tier`}
            >
              {buff.tier}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{buff.roast}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                Strengths
              </p>
              <ul className="space-y-1">
                {buff.strengths.map((s) => (
                  <li key={s} className="text-xs text-slate-300">
                    + {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-orange">
                Weaknesses
              </p>
              <ul className="space-y-1">
                {buff.weaknesses.map((w) => (
                  <li key={w} className="text-xs text-slate-300">
                    − {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Watch heatmap */}
        <section className="card animate-fade-up mt-6" style={{ animationDelay: "120ms" }}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-night-400">
              Last 6 months
            </h2>
            <p className="text-xs text-night-400">
              {totalDays} watch days · longest streak {streak}
            </p>
          </div>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex shrink-0 flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} ${day.count === 1 ? "film" : "films"}`}
                    className={`h-3 w-3 rounded-[3px] ${heatClass(day.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-night-400">
            Less
            {[0, 1, 2, 3].map((c) => (
              <span key={c} className={`h-2.5 w-2.5 rounded-[3px] ${heatClass(c)}`} />
            ))}
            More
          </div>
        </section>

        {/* Rating histogram */}
        <section className="card animate-fade-up mt-4" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-night-400">
            How you rate
          </h2>
          <div className="flex h-32 items-end gap-1.5">
            {histogram.map((count, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-night-400">{count > 0 ? count : ""}</span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-accent/50 to-accent transition-all"
                  style={{ height: `${Math.max(2, (count / maxHist) * 100)}%` }}
                />
                <span className="text-[10px] text-night-400">{(i + 1) / 2}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-night-400">
            stars
          </p>
        </section>

        {/* Decades */}
        <section className="card animate-fade-up mt-4" style={{ animationDelay: "240ms" }}>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-night-400">
            Films per decade
          </h2>
          <ul className="space-y-2">
            {decades.map((d) => (
              <li key={d.decade} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-xs font-bold text-slate-300">{d.decade}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-night-800">
                  <div
                    className="h-full rounded bg-gradient-to-r from-accent/60 to-accent"
                    style={{ width: `${(d.count / maxDecade) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-night-400">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
