/** Skeleton grid shown while picks are being generated. */
export function PickSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card animate-fade-up p-3"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="mb-3 aspect-[2/3] animate-pulse rounded-lg bg-night-800" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-night-800" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-night-800" />
        </div>
      ))}
    </div>
  );
}
