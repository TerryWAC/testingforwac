import { LETTERBOXD_FILM_URL, type Pick } from "@/lib/types";

/** Poster-less pick card — a stylized placeholder keeps the MVP API-free. */
export function PickCard({ pick }: { pick: Pick }) {
  return (
    <article className="card flex flex-col">
      <div className="mb-3 flex aspect-[3/2] items-center justify-center rounded-lg bg-gradient-to-br from-night-800 to-night-700 px-4 text-center">
        <span className="text-lg font-bold leading-snug text-slate-200">
          {pick.title}
          {pick.year && <span className="block text-sm font-medium text-night-400">{pick.year}</span>}
        </span>
      </div>
      <p className="flex-1 text-sm text-slate-300">{pick.why}</p>
      <a
        href={LETTERBOXD_FILM_URL(pick.slug)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 text-sm font-semibold text-accent hover:underline"
      >
        View on Letterboxd →
      </a>
    </article>
  );
}
