"use client";

import { useEffect, useState } from "react";

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

type Strategy = "same-era" | "contrast" | "marathon";

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

export function DoubleClient() {
  const [pool, setPool] = useState<Item[]>([]);
  const [strategy, setStrategy] = useState<Strategy>("same-era");
  const [source, setSource] = useState<CandidateSource>("watchlist");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(0); // reshuffle trigger
  const [retryTick, setRetryTick] = useState(0);

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
  const pairings = buildPairings(shuffled, strategy);
  const activeStrategy = STRATEGIES.find((s) => s.value === strategy)!;
  const posters = usePosters(pairings.flatMap((p) => p.films));

  return (
    <div className="min-h-screen">
      <AppNav active="double" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-white">Double Feature</h1>
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
          <span className="mx-1 h-4 w-px bg-night-700" />
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

        {loading ? (
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
                          <div className="overflow-hidden rounded-lg">
                            <Poster title={f.title} year={f.year} url={posters[f.slug]} />
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
