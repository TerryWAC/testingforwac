"use client";

import { useEffect, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Tilt } from "@/components/Tilt";
import { LETTERBOXD_SEARCH_URL } from "@/lib/types";

interface ReleaseItem {
  title: string;
  year: number | null;
  date: string;
  posterUrl: string | null;
}

interface Data {
  enabled: boolean;
  nowPlaying?: ReleaseItem[];
  upcoming?: ReleaseItem[];
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function monthOf(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function ComingClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/upcoming")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Group upcoming releases by month for a calendar feel.
  const byMonth = new Map<string, ReleaseItem[]>();
  for (const item of data?.upcoming ?? []) {
    const month = monthOf(item.date);
    byMonth.set(month, [...(byMonth.get(month) ?? []), item]);
  }

  return (
    <div className="min-h-screen">
      <AppNav active="coming" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up text-2xl font-bold text-white">Coming Soon</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          What&apos;s in cinemas now and on the release calendar.
        </p>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {data === null ? (
          <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-night-800" />
            ))}
          </div>
        ) : !data.enabled ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-white">Release data needs a TMDB key</p>
            <p className="mt-1 text-sm text-night-400">
              Add TMDB_API_KEY to your environment to light this page up.
            </p>
          </div>
        ) : (
          <>
            {/* In cinemas now */}
            {(data.nowPlaying?.length ?? 0) > 0 && (
              <section className="animate-fade-up mt-6" style={{ animationDelay: "120ms" }}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-night-400">
                  In cinemas now
                </h2>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {data.nowPlaying!.map((m) => (
                    <a
                      key={m.title}
                      href={LETTERBOXD_SEARCH_URL(m.title)}
                      target="_blank"
                      rel="noreferrer"
                      className="group w-28 shrink-0 sm:w-32"
                    >
                      <Tilt>
                        <div className="aspect-[2/3] overflow-hidden rounded-lg bg-night-800">
                          {m.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.posterUrl}
                              alt={`${m.title} poster`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-2 text-center text-xs font-bold text-slate-300">
                              {m.title}
                            </div>
                          )}
                        </div>
                      </Tilt>
                      <p className="mt-1.5 truncate text-xs font-semibold text-slate-300 group-hover:text-accent">
                        {m.title}
                      </p>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Calendar */}
            <section className="mt-8">
              {[...byMonth.entries()].map(([month, items], mi) => (
                <div key={month} className="animate-fade-up mb-6" style={{ animationDelay: `${mi * 80}ms` }}>
                  <h2 className="mb-2 border-b border-night-700/60 pb-1.5 text-sm font-bold uppercase tracking-wider text-accent">
                    {month}
                  </h2>
                  <ul className="space-y-2">
                    {items.map((m) => (
                      <li key={`${m.title}-${m.date}`}>
                        <a
                          href={LETTERBOXD_SEARCH_URL(m.title)}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-night-800"
                        >
                          <div className="w-10 shrink-0 overflow-hidden rounded bg-night-800">
                            <div className="aspect-[2/3]">
                              {m.posterUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.posterUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : null}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white group-hover:text-accent">
                              {m.title}
                            </p>
                            <p className="text-xs text-night-400">{formatDate(m.date)}</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-night-700 px-2.5 py-1 text-[11px] font-bold text-night-400 group-hover:border-accent group-hover:text-accent">
                            {formatDate(m.date).split(" ").slice(1).join(" ")}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {byMonth.size === 0 && (
                <p className="text-center text-sm text-night-400">
                  No upcoming release data right now — check back later.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
