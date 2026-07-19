"use client";

import { useState } from "react";

interface Props {
  title: string;
  year: number | null;
  url: string | null | undefined; // undefined = still loading, null = none found
  className?: string;
  sizes?: string;
}

/**
 * Film poster with a designed typographic fallback — never a broken image.
 * Shows a shimmer while the URL is being resolved.
 */
export function Poster({ title, year, url, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = url && !failed;

  return (
    <div
      className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-night-800 ${className}`}
    >
      {url === undefined && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-night-800 via-night-700 to-night-800" />
      )}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${title} poster`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        url !== undefined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-night-800 to-night-700 p-3 text-center">
            <span className="mb-2 h-1 w-8 rounded-full bg-accent" />
            <span className="text-sm font-black uppercase leading-tight tracking-wide text-slate-200">
              {title}
            </span>
            {year && <span className="mt-1.5 text-xs font-medium text-night-400">{year}</span>}
          </div>
        )
      )}
    </div>
  );
}
