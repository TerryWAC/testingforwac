/** Branded route-transition loader — server pages never feel frozen. */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex gap-2">
        <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-accent-orange" />
        <span
          className="h-3.5 w-3.5 animate-pulse rounded-full bg-accent"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-3.5 w-3.5 animate-pulse rounded-full bg-accent-blue"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-night-400">
        Letterboxd Night
      </p>
    </div>
  );
}
