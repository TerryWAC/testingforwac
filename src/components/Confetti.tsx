"use client";

import { useMemo } from "react";

/**
 * Lightweight CSS confetti burst — rendered only after user interaction
 * (winner reveals, champion screens), so no SSR mismatch concerns.
 */
export function Confetti({ count = 28 }: { count?: number }) {
  const pieces = useMemo(() => {
    const colors = ["#00c030", "#ff8000", "#40bcf4", "#e2e8f0"];
    return Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.8 + Math.random() * 1.4,
      size: 5 + Math.random() * 5,
      color: colors[i % colors.length],
    }));
  }, [count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.45}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
