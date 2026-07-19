"use client";

import { Poster } from "@/components/Poster";
import { Tilt } from "@/components/Tilt";
import { LETTERBOXD_FILM_URL, type Pick } from "@/lib/types";

interface Props {
  pick: Pick;
  posterUrl: string | null | undefined;
  index?: number;
}

export function PickCard({ pick, posterUrl, index = 0 }: Props) {
  return (
    <article
      className="card group animate-fade-up flex flex-col p-3 transition-transform duration-200 hover:-translate-y-1"
      style={{ animationDelay: `${Math.min(index * 70, 500)}ms` }}
    >
      <Tilt className="mb-3">
        <a
          href={LETTERBOXD_FILM_URL(pick.slug)}
          target="_blank"
          rel="noreferrer"
          className="relative block overflow-hidden rounded-lg"
        >
          <Poster title={pick.title} year={pick.year} url={posterUrl} />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8">
            <span className="block text-sm font-bold leading-tight text-white">
              {pick.title}
              {pick.year && <span className="ml-1.5 font-medium text-slate-400">{pick.year}</span>}
            </span>
          </span>
        </a>
      </Tilt>
      <p className="flex-1 text-sm leading-snug text-slate-300">{pick.why}</p>
      <a
        href={LETTERBOXD_FILM_URL(pick.slug)}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 text-xs font-semibold text-accent hover:underline"
      >
        View on Letterboxd →
      </a>
    </article>
  );
}
