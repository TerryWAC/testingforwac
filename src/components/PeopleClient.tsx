"use client";

import { useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Tilt } from "@/components/Tilt";
import { LETTERBOXD_SEARCH_URL } from "@/lib/types";

interface Person {
  id: number;
  name: string;
  photoUrl: string | null;
  role: string;
}

interface CreditFilm {
  title: string;
  year: number | null;
  posterUrl: string | null;
  role: string;
}

const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

export function PeopleClient({
  seenTitles,
  watchlistTitles,
}: {
  seenTitles: string[];
  watchlistTitles: string[];
}) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [films, setFilms] = useState<CreditFilm[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seen = new Set(seenTitles);
  const watchlist = new Set(watchlistTitles);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setSelected(null);
    setFilms(null);
    try {
      const res = await fetch(`/api/person?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (!json.enabled) throw new Error("Add a TMDB key to enable people search");
      setPeople(json.people ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function pick(person: Person) {
    setSelected(person);
    setFilms(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/person?id=${person.id}`);
      const json = await res.json();
      setFilms(json.films ?? []);
    } catch {
      setFilms([]);
    } finally {
      setBusy(false);
    }
  }

  const seenCount = (films ?? []).filter((f) => seen.has(normalize(f.title))).length;

  return (
    <div className="min-h-screen">
      <AppNav active="people" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up title-grad text-2xl font-bold">Directors &amp; Actors</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Search anyone, see their filmography, and how much of it you&apos;ve covered.
        </p>

        <form onSubmit={search} className="animate-fade-up mt-4 flex gap-2" style={{ animationDelay: "120ms" }}>
          <input
            className="input flex-1"
            placeholder="Tarantino, Zendaya, Nolan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy || !query.trim()}>
            {busy && !selected ? "Searching…" : "Search"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {/* People results */}
        {people && !selected && (
          <ul className="mt-5 space-y-2">
            {people.length === 0 && (
              <p className="text-center text-sm text-night-400">No one found — check the spelling.</p>
            )}
            {people.map((p, i) => (
              <li key={p.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <button
                  className="card flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:border-accent"
                  onClick={() => pick(p)}
                >
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-night-700 font-bold text-white">
                      {p.name.slice(0, 1)}
                    </span>
                  )}
                  <span>
                    <span className="block font-semibold text-white">{p.name}</span>
                    <span className="text-xs text-night-400">{p.role}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Filmography */}
        {selected && (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{selected.name}</h2>
              <button className="chip" onClick={() => setSelected(null)}>
                ← Back to results
              </button>
            </div>
            {films && films.length > 0 && (
              <p className="animate-pop-in mt-1 text-sm text-accent">
                You&apos;ve seen {seenCount} of {films.length}
              </p>
            )}
            {busy && !films ? (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-night-800" />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {(films ?? []).map((f, i) => {
                  const n = normalize(f.title);
                  const isSeen = seen.has(n);
                  const isWatchlisted = watchlist.has(n);
                  return (
                    <a
                      key={`${f.title}-${f.year}`}
                      href={LETTERBOXD_SEARCH_URL(f.title)}
                      target="_blank"
                      rel="noreferrer"
                      className="animate-fade-up group"
                      style={{ animationDelay: `${Math.min(i * 30, 600)}ms` }}
                    >
                      <Tilt>
                        <div
                          className={`relative aspect-[2/3] overflow-hidden rounded-lg border-2 bg-night-800 ${
                            isSeen
                              ? "border-accent/60"
                              : isWatchlisted
                                ? "border-accent-blue/60"
                                : "border-transparent"
                          }`}
                        >
                          {f.posterUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={f.posterUrl}
                              alt={`${f.title} poster`}
                              className={`h-full w-full object-cover ${isSeen ? "" : "opacity-80"}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-2 text-center text-xs font-bold text-slate-300">
                              {f.title}
                            </div>
                          )}
                          {isSeen && (
                            <span className="absolute right-1 top-1 rounded bg-accent px-1 text-[9px] font-black text-night-950">
                              SEEN
                            </span>
                          )}
                          {!isSeen && isWatchlisted && (
                            <span className="absolute right-1 top-1 rounded bg-accent-blue px-1 text-[9px] font-black text-night-950">
                              LIST
                            </span>
                          )}
                        </div>
                      </Tilt>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-300 group-hover:text-accent">
                        {f.title}
                      </p>
                      <p className="text-[10px] text-night-400">{f.year ?? ""}</p>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!people && !selected && (
          <p className="mt-10 text-center text-sm text-night-400">
            Try a director you love — see how deep your coverage really goes.
          </p>
        )}
      </main>
    </div>
  );
}
