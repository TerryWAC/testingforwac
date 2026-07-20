"use client";

import Link from "next/link";
import { useState } from "react";

export type NavKey =
  | "dashboard"
  | "faceoff"
  | "veto"
  | "wheel"
  | "slots"
  | "match"
  | "double"
  | "coin"
  | "coming"
  | "people"
  | "gauntlet"
  | "stats"
  | "wrapped"
  | "compare"
  | "profile";

interface NavLink {
  href: string;
  key: NavKey;
  label: string;
}

const SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Pick tonight",
    links: [
      { href: "/dashboard", key: "dashboard", label: "Tonight" },
      { href: "/faceoff", key: "faceoff", label: "Final Cut" },
      { href: "/veto", key: "veto", label: "Veto Draft" },
      { href: "/wheel", key: "wheel", label: "Spin the Wheel" },
      { href: "/slots", key: "slots", label: "Lucky Slots" },
      { href: "/match", key: "match", label: "Movie Match" },
      { href: "/double", key: "double", label: "Double Feature" },
      { href: "/coin", key: "coin", label: "Coin Flip" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/coming", key: "coming", label: "Coming Soon" },
      { href: "/people", key: "people", label: "Directors & Actors" },
      { href: "/gauntlet", key: "gauntlet", label: "The Gauntlet" },
      { href: "/stats", key: "stats", label: "Your Stats" },
      { href: "/wrapped", key: "wrapped", label: "Wrapped" },
    ],
  },
  {
    title: "Together",
    links: [{ href: "/compare", key: "compare", label: "Compare" }],
  },
  {
    title: "You",
    links: [{ href: "/profile", key: "profile", label: "Profile & Friends" }],
  },
];

const ALL_LINKS = SECTIONS.flatMap((s) => s.links);

export function AppNav({ active }: { active: NavKey }) {
  const [open, setOpen] = useState(false);
  const current = ALL_LINKS.find((l) => l.key === active);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-night-700/60 bg-night-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-lg border border-night-700 bg-night-900 transition-colors hover:border-accent"
          >
            <span className="h-0.5 w-[18px] rounded-full bg-slate-300" />
            <span className="h-0.5 w-[18px] rounded-full bg-slate-300" />
            <span className="ml-[11px] h-0.5 w-[12px] self-start rounded-full bg-accent" />
          </button>
          <span className="flex gap-1" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-accent-orange" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent-blue" />
          </span>
          <span className="text-sm font-bold tracking-tight text-white">Letterboxd Night</span>
          <span className="ml-auto text-xs font-medium text-night-400">{current?.label}</span>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50" style={{ perspective: "1200px" }}>
          <div
            className="animate-overlay-in absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav className="animate-drawer-in absolute inset-y-0 left-0 flex w-72 max-w-[82vw] flex-col overflow-y-auto border-r border-night-700/60 bg-night-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex gap-1" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-orange" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-blue" />
                </span>
                <span className="font-bold text-white">Letterboxd Night</span>
              </div>
              <button
                aria-label="Close menu"
                className="rounded-lg p-2 text-night-400 hover:bg-night-800 hover:text-white"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            {SECTIONS.map((section, si) => (
              <div key={section.title} className="mb-3">
                <p
                  className="animate-fade-up mb-1 px-3.5 text-[10px] font-bold uppercase tracking-widest text-night-400"
                  style={{ animationDelay: `${40 + si * 60}ms` }}
                >
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.links.map((l, i) => (
                    <li
                      key={l.key}
                      className="animate-fade-up"
                      style={{ animationDelay: `${60 + si * 60 + i * 25}ms` }}
                    >
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                          active === l.key
                            ? "bg-accent/15 text-accent"
                            : "text-slate-300 hover:bg-night-800 hover:text-white"
                        }`}
                      >
                        {l.label}
                        {active === l.key && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-auto border-t border-night-700/60 pt-3">
              <Link
                href="/setup"
                onClick={() => setOpen(false)}
                className="flex items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-night-800 hover:text-white"
              >
                Update library
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
