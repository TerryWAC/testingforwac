"use client";

import { useEffect, useMemo, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Rail } from "@/components/Rail";
import { Tilt } from "@/components/Tilt";
import { LETTERBOXD_SEARCH_URL, STREMIO_SEARCH_URL } from "@/lib/types";

interface ReleaseItem {
  title: string;
  year: number | null;
  date: string;
  posterUrl: string | null;
  onWatchlist?: boolean;
}

interface Data {
  enabled: boolean;
  nowPlaying?: ReleaseItem[];
  upcoming?: ReleaseItem[];
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function ComingClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/upcoming")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, []);

  const filmsByDate = useMemo(() => {
    const map = new Map<string, ReleaseItem[]>();
    for (const item of data?.upcoming ?? []) {
      map.set(item.date, [...(map.get(item.date) ?? []), item]);
    }
    return map;
  }, [data]);

  const watchlisted = (data?.upcoming ?? []).filter((m) => m.onWatchlist);

  // Month being displayed.
  const base = new Date();
  const shown = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const monthLabel = shown.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const daysInMonth = new Date(shown.getFullYear(), shown.getMonth() + 1, 0).getDate();
  const startPad = (shown.getDay() + 6) % 7; // Monday-first
  const todayIso = new Date().toISOString().slice(0, 10);

  const isoFor = (day: number) =>
    `${shown.getFullYear()}-${String(shown.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Furthest month with data, so the forward arrow knows when to stop.
  const maxDate = (data?.upcoming ?? []).reduce((acc, m) => (m.date > acc ? m.date : acc), todayIso);
  const maxOffset =
    (Number(maxDate.slice(0, 4)) - base.getFullYear()) * 12 +
    (Number(maxDate.slice(5, 7)) - 1 - base.getMonth());

  const selectedFilms = selectedDate ? (filmsByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="min-h-screen">
      <AppNav active="coming" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up title-grad text-2xl font-bold">Coming Soon</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          The release calendar — tap a day to see what drops.
        </p>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {data === null ? (
          <div className="mt-8 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-night-800" />
            ))}
          </div>
        ) : !data.enabled ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-white">Release data needs a TMDB key</p>
            <p className="mt-1 text-sm text-night-400">
              Release data isn&apos;t available right now — check back soon.
            </p>
          </div>
        ) : (
          <>
            {/* From your watchlist — the true "recommended" signal */}
            {watchlisted.length > 0 && (
              <section className="animate-fade-up mt-6" style={{ animationDelay: "100ms" }}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-accent">
                  From your watchlist
                </h2>
                <Rail>
                  {watchlisted.map((m) => (
                    <a
                      key={`${m.title}-${m.date}`}
                      href={LETTERBOXD_SEARCH_URL(m.title)}
                      target="_blank"
                      rel="noreferrer"
                      className="group w-28 shrink-0 sm:w-32"
                    >
                      <Tilt>
                        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-accent/40 bg-night-800">
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
                      <p className="text-[11px] text-accent">{formatDay(m.date)}</p>
                    </a>
                  ))}
                </Rail>
              </section>
            )}

            {/* In cinemas now */}
            {(data.nowPlaying?.length ?? 0) > 0 && (
              <section className="animate-fade-up mt-6" style={{ animationDelay: "140ms" }}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-400">
                  In cinemas now
                </h2>
                <Rail>
                  {data.nowPlaying!.map((m) => (
                    <a
                      key={m.title}
                      href={LETTERBOXD_SEARCH_URL(m.title)}
                      target="_blank"
                      rel="noreferrer"
                      className="group w-24 shrink-0 sm:w-28"
                    >
                      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-night-800 transition-transform duration-200 group-hover:scale-[1.04]">
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
                      <p className="mt-1.5 truncate text-xs font-semibold text-slate-300 group-hover:text-accent">
                        {m.title}
                      </p>
                    </a>
                  ))}
                </Rail>
              </section>
            )}

            {/* Calendar grid */}
            <section className="animate-fade-up mt-8" style={{ animationDelay: "180ms" }}>
              <div className="mb-3 flex items-center justify-between">
                <button
                  className="btn-secondary px-3 py-1.5 text-sm"
                  onClick={() => {
                    setMonthOffset((o) => o - 1);
                    setSelectedDate(null);
                  }}
                  disabled={monthOffset <= 0}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  {monthLabel}
                </h2>
                <button
                  className="btn-secondary px-3 py-1.5 text-sm"
                  onClick={() => {
                    setMonthOffset((o) => o + 1);
                    setSelectedDate(null);
                  }}
                  disabled={monthOffset >= maxOffset}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((d, i) => (
                  <span key={`${d}-${i}`} className="pb-1 text-[10px] font-bold uppercase text-night-400">
                    {d}
                  </span>
                ))}
                {Array.from({ length: startPad }).map((_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const iso = isoFor(day);
                  const films = filmsByDate.get(iso) ?? [];
                  const isToday = iso === todayIso;
                  const isSelected = iso === selectedDate;
                  const hasWatchlisted = films.some((f) => f.onWatchlist);
                  return (
                    <button
                      key={iso}
                      onClick={() => setSelectedDate(films.length > 0 ? iso : null)}
                      className={`relative aspect-square overflow-hidden rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-accent ring-1 ring-accent"
                          : hasWatchlisted
                            ? "border-accent/50"
                            : films.length > 0
                              ? "border-night-700 hover:border-night-400"
                              : "border-night-800/60"
                      } ${films.length === 0 ? "cursor-default bg-night-900/50" : "bg-night-800"}`}
                    >
                      {films[0]?.posterUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={films[0].posterUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-60"
                          loading="lazy"
                        />
                      )}
                      <span
                        className={`absolute left-1 top-0.5 text-[11px] font-bold ${
                          isToday
                            ? "flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-night-950"
                            : films.length > 0
                              ? "text-white drop-shadow"
                              : "text-night-700"
                        }`}
                      >
                        {day}
                      </span>
                      {films.length > 1 && (
                        <span className="absolute bottom-0.5 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                          +{films.length - 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected day detail */}
              {selectedDate && selectedFilms.length > 0 && (
                <div className="card animate-fade-up mt-4">
                  <p className="mb-3 text-sm font-bold text-white">{formatDay(selectedDate)}</p>
                  <ul className="space-y-3">
                    {selectedFilms.map((m) => (
                      <li key={m.title} className="flex items-center gap-3">
                        <div className="w-12 shrink-0 overflow-hidden rounded bg-night-800">
                          <div className="aspect-[2/3]">
                            {m.posterUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.posterUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-tight text-white">
                            {m.title}
                            {m.onWatchlist && (
                              <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                                Watchlist
                              </span>
                            )}
                          </p>
                          <div className="mt-1 flex gap-3">
                            <a
                              href={LETTERBOXD_SEARCH_URL(m.title)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-accent hover:underline"
                            >
                              Letterboxd
                            </a>
                            <a
                              href={STREMIO_SEARCH_URL(m.title)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-accent-blue hover:underline"
                            >
                              Stremio
                            </a>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!selectedDate && (
                <p className="mt-3 text-center text-xs text-night-400">
                  Days with posters have releases — tap one. Green edges mean your watchlist.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
