"use client";

import Link from "next/link";
import { useState } from "react";

import { AppNav } from "@/components/AppNav";
import { LETTERBOXD_FILM_URL } from "@/lib/types";

interface Props {
  username: string;
  year: number;
  years: number[];
  total: number;
  monthCounts: number[];
  avgRating: number | null;
  topDecade: string | null;
  topRated: { slug: string; title: string; year: number | null; rating: number }[];
  firstFilm: { title: string; date: string } | null;
  lastFilm: { title: string; date: string } | null;
  streak: number;
  weeksElapsed: number;
  minutesWatched: number;
  busiestMonth: string | null;
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function formatWatchTime(mins: number): string {
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} ${hours} hrs`;
  const m = mins % 60;
  return hours > 0 ? `${hours} hrs ${m} min` : `${m} min`;
}

export function WrappedClient(props: Props) {
  const { year, years, total, monthCounts, avgRating, topDecade, topRated, firstFilm, lastFilm, streak, weeksElapsed, minutesWatched, busiestMonth } = props;
  const [copied, setCopied] = useState(false);
  const maxMonth = Math.max(1, ...monthCounts);

  async function share() {
    const text = `My ${year} in film: ${total} films, ${formatWatchTime(minutesWatched)} of watching, ${avgRating ?? "-"}★ average, top decade ${topDecade ?? "-"}, longest streak ${streak} days. 🎬`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }

  return (
    <div className="min-h-screen">
      <AppNav active="wrapped" />
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="animate-fade-up title-grad text-2xl font-bold">Wrapped</h1>
        {years.length > 1 && (
          // Every year you've logged, not just the latest few — the row scrolls
          // sideways rather than truncating.
          <div
            className="animate-fade-up -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1"
            style={{ animationDelay: "60ms" }}
          >
            {years.map((y) => (
              <Link
                key={y}
                href={`/wrapped?year=${y}`}
                className={`chip shrink-0 ${y === year ? "chip-active" : ""}`}
              >
                {y}
              </Link>
            ))}
          </div>
        )}

        {total === 0 ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-white">Nothing logged in {year}</p>
            <p className="mt-1 text-sm text-night-400">Pick another year above.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Hero */}
            <section className="animate-pop-in card bg-gradient-to-br from-accent/15 via-night-900 to-accent-blue/10 py-8 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-night-400">
                Your {year} in film
              </p>
              <p className="mt-2 text-6xl font-black text-accent">{total}</p>
              <p className="mt-1 text-sm font-semibold text-slate-300">films watched</p>
            </section>

            {/* Time watched */}
            {minutesWatched > 0 && (
              <section
                className="card animate-fade-up bg-gradient-to-br from-accent-blue/10 via-night-900 to-night-900 py-6 text-center"
                style={{ animationDelay: "90ms" }}
              >
                <p className="text-4xl font-black text-accent-blue">
                  {formatWatchTime(minutesWatched)}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-300">
                  in front of films this year
                </p>
                <p className="mt-0.5 text-[10px] text-night-400">estimated from real runtimes</p>
              </section>
            )}

            {/* Months */}
            <section className="card animate-fade-up" style={{ animationDelay: "120ms" }}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-night-400">
                Month by month
              </h2>
              <div className="flex h-24 items-end gap-1">
                {monthCounts.map((c, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    {/* Pixel heights: % of an auto-height flex child collapses to 0 */}
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-accent/50 to-accent"
                      style={{ height: `${Math.max(3, Math.round((c / maxMonth) * 74))}px` }}
                    />
                    <span className="text-[9px] text-night-400">{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
              {busiestMonth && (
                <p className="mt-2 text-center text-xs text-night-400">
                  Peak cinema: <span className="font-bold text-accent">{busiestMonth}</span>
                </p>
              )}
            </section>

            {/* Tiles */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile delay={180} label="Average rating" value={avgRating !== null ? `${avgRating}★` : "—"} />
              <StatTile delay={220} label="Top decade" value={topDecade ?? "—"} />
              <StatTile delay={260} label="Longest streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} />
              <StatTile
                delay={300}
                label="Films a week"
                value={(total / weeksElapsed).toFixed(1)}
              />
            </div>

            {/* Top rated */}
            {topRated.length > 0 && (
              <section className="card animate-fade-up" style={{ animationDelay: "340ms" }}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-night-400">
                  Your five stars of {year}
                </h2>
                <ul className="space-y-1.5">
                  {topRated.map((f, i) => (
                    <li key={`${f.slug}-${i}`} className="flex items-baseline justify-between text-sm">
                      <a
                        href={LETTERBOXD_FILM_URL(f.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-slate-300 hover:text-accent"
                      >
                        <span className="mr-2 font-black text-night-400">{i + 1}</span>
                        {f.title}
                      </a>
                      <span className="ml-2 shrink-0 text-accent">{f.rating}★</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Bookends */}
            {firstFilm && lastFilm && (
              <section className="card animate-fade-up" style={{ animationDelay: "380ms" }}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-night-400">
                  Bookends
                </h2>
                <p className="text-sm text-slate-300">
                  You opened {year} with{" "}
                  <span className="font-bold text-white">{firstFilm.title}</span>
                  {firstFilm.title !== lastFilm.title && (
                    <>
                      {" "}
                      and {year === new Date().getFullYear() ? "your latest is" : "closed it with"}{" "}
                      <span className="font-bold text-white">{lastFilm.title}</span>
                    </>
                  )}
                  .
                </p>
              </section>
            )}

            <button className="btn-primary animate-fade-up w-full" style={{ animationDelay: "420ms" }} onClick={share}>
              {copied ? "Copied to clipboard" : "Share your year"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StatTile({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="card animate-fade-up py-4 text-center" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-night-400">{label}</p>
    </div>
  );
}
