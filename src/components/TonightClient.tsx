"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Poster } from "@/components/Poster";
import { Tilt } from "@/components/Tilt";
import { usePosters } from "@/lib/usePosters";
import { letterboxdUrl, STREMIO_SEARCH_URL } from "@/lib/types";

interface Feature {
  slug: string;
  title: string;
  year: number | null;
  discovery: boolean;
  startedAt: number;
}

const STORE_KEY = "lbnight-tonight";

/**
 * Tonight Mode — the ceremonial full-screen "we're watching this" screen.
 * Ends with a one-tap hand-off to log the film on Letterboxd.
 */
export function TonightClient({
  slug,
  title,
  year,
  discovery,
}: {
  slug: string | null;
  title: string | null;
  year: number | null;
  discovery: boolean;
}) {
  const router = useRouter();
  const [feature, setFeature] = useState<Feature | null>(null);

  useEffect(() => {
    if (slug && title) {
      const fresh: Feature = { slug, title, year, discovery, startedAt: Date.now() };
      try {
        const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as Feature | null;
        // Same film already running? Keep its original start time.
        if (stored?.slug === slug) {
          setFeature(stored);
          return;
        }
        localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
      } catch {}
      setFeature(fresh);
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as Feature | null;
        if (stored) setFeature(stored);
      } catch {}
    }
  }, [slug, title, year, discovery]);

  const posters = usePosters(
    feature ? [{ slug: feature.slug, title: feature.title, year: feature.year }] : []
  );
  const posterUrl = feature ? posters[feature.slug] : undefined;

  function endNight() {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
    router.push("/dashboard");
  }

  if (!feature) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="font-semibold text-white">No feature presentation running</p>
        <p className="mt-1 text-sm text-night-400">
          Pick a film anywhere in the app and tap &ldquo;Watch tonight&rdquo;.
        </p>
        <button className="btn-primary mt-5" onClick={() => router.push("/dashboard")}>
          Back to Tonight
        </button>
      </div>
    );
  }

  const startedTime = new Date(feature.startedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10">
      {/* Blurred poster backdrop */}
      {posterUrl && (
        <div
          className="absolute inset-0 opacity-20 blur-3xl"
          style={{
            backgroundImage: `url(${posterUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-night-950/60 via-transparent to-night-950" />

      <div className="animate-pop-in relative w-full max-w-xs text-center">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-accent">
          Feature presentation
        </p>
        <Tilt max={10} className="mx-auto mt-5 w-56 sm:w-64">
          <div className="animate-float">
            <div className="animate-glow overflow-hidden rounded-xl">
              <Poster title={feature.title} year={feature.year} url={posterUrl} />
            </div>
          </div>
        </Tilt>
        <h1 className="mt-5 text-3xl font-black leading-tight text-white">
          {feature.title}
          {feature.year && (
            <span className="ml-2 text-xl font-medium text-night-400">{feature.year}</span>
          )}
        </h1>
        <p className="mt-1.5 text-xs text-night-400">Rolling since {startedTime} · enjoy the film</p>

        <div className="mt-7 flex flex-col gap-2.5">
          <a
            href={letterboxdUrl(feature)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary w-full"
          >
            Log it on Letterboxd
          </a>
          <a
            href={STREMIO_SEARCH_URL(feature.title)}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary w-full"
          >
            Find on Stremio
          </a>
          <button
            className="mt-1 text-xs font-semibold text-night-400 transition-colors hover:text-white"
            onClick={endNight}
          >
            End the night
          </button>
        </div>
      </div>
    </div>
  );
}
