"use client";

import { useRef } from "react";

/**
 * Horizontal poster rail with desktop scroll arrows — sideways mouse
 * scrolling is awkward, so arrows appear on hover (touch swipes unaffected).
 */
export function Rail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function scroll(dir: -1 | 1) {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  }

  return (
    <div className="group relative">
      <div
        ref={ref}
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        aria-label="Scroll left"
        onClick={() => scroll(-1)}
        className="absolute -left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-night-700 bg-night-900/95 text-lg text-slate-300 opacity-0 shadow-lg transition-opacity hover:border-accent hover:text-accent group-hover:opacity-100 md:flex"
      >
        ‹
      </button>
      <button
        aria-label="Scroll right"
        onClick={() => scroll(1)}
        className="absolute -right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-night-700 bg-night-900/95 text-lg text-slate-300 opacity-0 shadow-lg transition-opacity hover:border-accent hover:text-accent group-hover:opacity-100 md:flex"
      >
        ›
      </button>
    </div>
  );
}
