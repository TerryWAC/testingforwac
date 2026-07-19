"use client";

import Link from "next/link";

const LINKS = [
  { href: "/dashboard", key: "dashboard", label: "Tonight" },
  { href: "/wheel", key: "wheel", label: "Wheel" },
  { href: "/match", key: "match", label: "Match" },
  { href: "/double", key: "double", label: "Double" },
  { href: "/compare", key: "compare", label: "Compare" },
] as const;

export function AppNav({ active }: { active: (typeof LINKS)[number]["key"] }) {
  return (
    <nav className="sticky top-0 z-20 border-b border-night-700/60 bg-night-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto px-4 py-2">
        {LINKS.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active === l.key
                ? "bg-night-700 text-white"
                : "text-night-400 hover:bg-night-800 hover:text-slate-300"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
