"use client";

import { useState } from "react";

import { FilmInfoSheet } from "@/components/FilmInfoSheet";
import { Poster } from "@/components/Poster";
import { Tilt } from "@/components/Tilt";
import { letterboxdUrl, type Pick } from "@/lib/types";

interface Props {
  pick: Pick;
  posterUrl: string | null | undefined;
  index?: number;
}

export function PickCard({ pick, posterUrl, index = 0 }: Props) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <article
      className="card group animate-fade-up flex flex-col p-3 transition-transform duration-200 hover:-translate-y-1"
      style={{ animationDelay: `${Math.min(index * 70, 500)}ms` }}
    >
      <Tilt className="mb-3">
        <div className="relative overflow-hidden rounded-lg">
          <a href={letterboxdUrl(pick)} target="_blank" rel="noreferrer" className="block">
            <Poster title={pick.title} year={pick.year} url={posterUrl} />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8">
              <span className="block text-sm font-bold leading-tight text-white">
                {pick.title}
                {pick.year && (
                  <span className="ml-1.5 font-medium text-slate-400">{pick.year}</span>
                )}
              </span>
            </span>
          </a>
          <button
            aria-label={`More about ${pick.title}`}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-sm font-bold text-white backdrop-blur transition-colors hover:border-accent hover:text-accent"
            onClick={() => setShowInfo(true)}
          >
            i
          </button>
        </div>
      </Tilt>
      <p className="flex-1 text-sm leading-snug text-slate-300">{pick.why}</p>
      <a
        href={letterboxdUrl(pick)}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 text-xs font-semibold text-accent hover:underline"
      >
        View on Letterboxd
      </a>

      {showInfo && (
        <FilmInfoSheet
          target={{ ...pick, posterUrl, why: pick.why }}
          onClose={() => setShowInfo(false)}
        />
      )}
    </article>
  );
}
