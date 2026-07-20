"use client";

import { useEffect, useMemo, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Poster } from "@/components/Poster";
import { Tilt } from "@/components/Tilt";
import { fetchCandidates, type CandidateSource } from "@/lib/candidatesCache";
import { usePosters } from "@/lib/usePosters";
import { letterboxdUrl } from "@/lib/types";

interface Item {
  slug: string;
  title: string;
  year: number | null;
  reasons: string[];
  discovery?: boolean;
}

type Strategy = "same-era" | "contrast" | "marathon" | "director";

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

function formatMins(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const STRATEGIES: { value: Strategy; label: string; blurb: string }[] = [
  {
    value: "same-era",
    label: "Same era",
    blurb: "Two films from the same decade — one cohesive vibe all night.",
  },
  {
    value: "contrast",
    label: "Contrast",
    blurb: "Decades apart — see how the same night can hold two worlds.",
  },
  {
    value: "marathon",
    label: "Marathon",
    blurb: "Three films, oldest to newest — clear the couch.",
  },
  {
    value: "director",
    label: "By director",
    blurb: "Type any director or actor — pairings straight from their filmography.",
  },
];

interface Pairing {
  films: Item[];
  why: string;
}

function decade(year: number | null): number | null {
  return year ? Math.floor(year / 10) * 10 : null;
}

/** Build pairings client-side from the deterministic candidate pool. */
function buildPairings(pool: Item[], strategy: Strategy): Pairing[] {
  const withYear = pool.filter((f) => f.year !== null);
  const results: Pairing[] = [];
  const used = new Set<string>();

  if (strategy === "same-era") {
    const byDecade = new Map<number, Item[]>();
    for (const f of withYear) {
      const d = decade(f.year)!;
      byDecade.set(d, [...(byDecade.get(d) ?? []), f]);
    }
    for (const [d, films] of [...byDecade.entries()].sort((a, b) => b[1].length - a[1].length)) {
      for (let i = 0; i + 1 < films.length && results.length < 4; i += 2) {
        results.push({
          films: [films[i], films[i + 1]],
          why: `Both from the ${d}s — a matched double bill that keeps one mood going all night.`,
        });
      }
    }
  } else if (strategy === "contrast") {
    const sorted = [...withYear].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    let lo = 0;
    let hi = sorted.length - 1;
    while (lo < hi && results.length < 4) {
      const a = sorted[lo];
      const b = sorted[hi];
      if (!used.has(a.slug) && !used.has(b.slug) && decade(a.year) !== decade(b.year)) {
        used.add(a.slug);
        used.add(b.slug);
        results.push({
          films: [a, b],
          why: `${a.year} meets ${b.year} — start in one era, end in another and feel the jump.`,
        });
      }
      lo++;
      hi--;
    }
  } else {
    // marathon: chronological runs of 3
    const sorted = [...withYear].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    for (let i = 0; i + 2 < sorted.length && results.length < 3; i += 3) {
      const trio = [sorted[i], sorted[i + 1], sorted[i + 2]];
      results.push({
        films: trio,
        why: `A ${trio[0].year}→${trio[2].year} marathon in watch order — settle in.`,
      });
    }
  }
  return results;
}

export function DoubleClient({ seenTitles }: { seenTitles: string[] }) {
  const seen = useMemo(() => new Set(seenTitles), [seenTitles]);
  const [pool, setPool] = useState<Item[]>([]);
  const [strategy, setStrategy] = useState<Strategy>("same-era");
  const [source, setSource] = useState<CandidateSource>("watchlist");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(0); // reshuffle trigger
  const [retryTick, setRetryTick] = useState(0);
  const [personQuery, setPersonQuery] = useState("");
  const [personName, setPersonName] = useState<string | null>(null);
  const [personFilms, setPersonFilms] = useState<Item[] | null>(null);
  const [personPosters, setPersonPosters] = useState<Record<string, string | null>>({});
  const [personBusy, setPersonBusy] = useState(false);
  const [runtimes, setRuntimes] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCandidates(source, allowRewatches, 60)
      .then((candidates) => {
        if (!cancelled) setPool(candidates);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, allowRewatches, retryTick]);

  async function searchPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!personQuery.trim() || personBusy) return;
    setPersonBusy(true);
    setError(null);
    try {
      const sRes = await fetch(`/api/person?q=${encodeURIComponent(personQuery.trim())}`).then((r) => r.json());
      const person = sRes.people?.[0];
      if (!person) throw new Error("No one found by that name");
      const fRes = await fetch(`/api/person?id=${person.id}`).then((r) => r.json());
      const films: Item[] = (fRes.films ?? []).map(
        (f: { title: string; year: number | null; posterUrl: string | null }) => ({
          slug: normTitle(f.title) + (f.year ?? ""),
          title: f.title,
          year: f.year,
          reasons: [],
          discovery: true,
        })
      );
      const posterMap: Record<string, string | null> = {};
      (fRes.films ?? []).forEach(
        (f: { title: string; year: number | null; posterUrl: string | null }) => {
          posterMap[normTitle(f.title) + (f.year ?? "")] = f.posterUrl;
        }
      );
      if (films.length < 2) throw new Error(`Not enough films found for ${person.name}`);
      setPersonName(person.name);
      setPersonFilms(films);
      setPersonPosters(posterMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setPersonBusy(false);
    }
  }

  // Shuffle deterministically per seed so "Reshuffle" gives new pairings.
  const shuffled = [...pool];
  if (seed > 0) {
    let s = seed;
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }
  let pairings: Pairing[];
  if (strategy === "director") {
    pairings = [];
    if (personFilms && personName) {
      const ordered = [...personFilms].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      // Seed rotation so reshuffle gives different windows of the filmography.
      const start = seed % Math.max(1, ordered.length - 1);
      const rotated = [...ordered.slice(start), ...ordered.slice(0, start)];
      for (let i = 0; i + 1 < rotated.length && pairings.length < 4; i += 2) {
        const a = rotated[i];
        const b = rotated[i + 1];
        pairings.push({
          films: [a, b],
          why: `Two from ${personName}'s filmography — ${a.year ?? "?"} and ${b.year ?? "?"}.`,
        });
      }
    }
  } else {
    pairings = buildPairings(shuffled, strategy);
  }
  const activeStrategy = STRATEGIES.find((s) => s.value === strategy)!;
  const posters = usePosters(pairings.flatMap((p) => p.films.filter((f) => !(f.slug in personPosters))));

  // Combined runtimes for each pairing.
  const pairingKey = pairings.map((p) => p.films.map((f) => f.slug).join("+")).join("|");
  useEffect(() => {
    const items = pairings
      .flatMap((p) => p.films)
      .filter((f) => !(f.slug in runtimes))
      .slice(0, 12)
      .map((f) => ({ slug: f.slug, title: f.title, year: f.year }));
    if (items.length === 0) return;
    fetch("/api/runtimes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.runtimes) setRuntimes((prev) => ({ ...prev, ...json.runtimes }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairingKey]);

  return (
    <div className="min-h-screen">
      <AppNav active="double" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="title-grad text-2xl font-bold">Double Feature</h1>
        <p className="mt-1 text-sm text-night-400">{activeStrategy.blurb}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {STRATEGIES.map((s) => (
            <button
              key={s.value}
              className={`chip ${strategy === s.value ? "chip-active" : ""}`}
              onClick={() => setStrategy(s.value)}
            >
              {s.label}
            </button>
          ))}
          {strategy !== "director" && <span className="mx-1 h-4 w-px bg-night-700" />}
          {strategy !== "director" && (
          <button
            className={`chip ${source === "watchlist" ? "chip-active" : ""}`}
            onClick={() => setSource("watchlist")}
          >
            Watchlist
          </button>
          )}
          {strategy !== "director" && (
          <button
            className={`chip ${source === "all" ? "chip-active" : ""}`}
            onClick={() => setSource("all")}
          >
            Whole library
          </button>
          )}
          {strategy !== "director" && (
          <button
            className={`chip ${source === "classics" ? "chip-active" : ""}`}
            onClick={() => setSource("classics")}
          >
            Classics
          </button>
          )}
          {strategy !== "director" && (
          <label className="chip flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={allowRewatches}
              onChange={(e) => setAllowRewatches(e.target.checked)}
              className="h-3 w-3 accent-[#00c030]"
            />
            Rewatches
          </label>
          )}
        </div>

        {strategy === "director" && (
          <form onSubmit={searchPerson} className="animate-fade-up mt-3 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Nolan, Greta Gerwig, Spielberg…"
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={personBusy || !personQuery.trim()}>
              {personBusy ? "Finding…" : "Find"}
            </button>
          </form>
        )}

{error && (
          <p className="mt-4 text-sm text-red-400">
            {error}{" "}
            <button
              className="ml-1 font-semibold underline hover:text-white"
              onClick={() => setRetryTick((t) => t + 1)}
            >
              Retry
            </button>
          </p>
        )}

        {strategy === "director" && pairings.length === 0 ? (
          <p className="mt-10 text-center text-sm text-night-400">
            {personBusy
              ? "Digging through the filmography…"
              : "Search a director or actor above to build pairings from their work."}
          </p>
        ) : loading && strategy !== "director" ? (
          <p className="mt-10 text-center text-sm text-night-400">Pairing your films…</p>
        ) : pairings.length === 0 ? (
          <div className="card mt-6 text-center">
            <p className="font-semibold text-white">Not enough films with years to pair</p>
            <p className="mt-1 text-sm text-night-400">
              Try &ldquo;Whole library&rdquo;, allow rewatches, or sync more films.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              {pairings.map((p, i) => (
                <article
                  key={i}
                  className="card animate-fade-up"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className={`grid gap-3 ${p.films.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {p.films.map((f, j) => (
                      <a
                        key={f.slug}
                        href={letterboxdUrl(f)}
                        target="_blank"
                        rel="noreferrer"
                        className="group text-center"
                      >
                        <Tilt>
                          <div className="relative overflow-hidden rounded-lg">
                            <Poster
                              title={f.title}
                              year={f.year}
                              url={f.slug in personPosters ? personPosters[f.slug] : posters[f.slug]}
                            />
                            {seen.has(normTitle(f.title)) && (
                              <span className="absolute right-1 top-1 rounded bg-accent px-1 text-[9px] font-black text-night-950">
                                SEEN
                              </span>
                            )}
                          </div>
                        </Tilt>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-accent">
                          {p.films.length === 3
                            ? ["Opener", "Main", "Closer"][j]
                            : ["Starter", "Main event"][j]}
                        </p>
                        <p className="mt-0.5 text-sm font-bold leading-tight text-white group-hover:text-accent">
                          {f.title}
                        </p>
                        {f.year && <p className="text-xs text-night-400">{f.year}</p>}
                      </a>
                    ))}
                  </div>
                  <p className="mt-3 border-t border-night-700/60 pt-3 text-sm text-slate-300">
                    {p.why}
                  </p>
                  {(() => {
                    const mins = p.films.map((f) => runtimes[f.slug]);
                    if (mins.some((m) => m === undefined)) return null;
                    const known = mins.filter((m): m is number => typeof m === "number");
                    if (known.length === 0) return null;
                    const total = known.reduce((a, b) => a + b, 0);
                    return (
                      <p className="mt-1.5 text-xs font-semibold text-accent">
                        {known.length < p.films.length ? "At least " : "Combined runtime: "}
                        {formatMins(total)}
                        {known.length < p.films.length && " combined"}
                      </p>
                    );
                  })()}
                </article>
              ))}
            </div>
            <button
              className="btn-secondary mt-5 w-full"
              onClick={() => setSeed((s) => s + 1)}
            >
              Reshuffle pairings
            </button>
          </>
        )}
      </main>
    </div>
  );
}
