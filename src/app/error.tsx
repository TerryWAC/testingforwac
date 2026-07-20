"use client";

/** Global error boundary — friendly recovery instead of a white screen. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent-orange">
        Reel jammed
      </p>
      <h1 className="mt-2 text-2xl font-bold text-white">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-night-400">
        {error.message || "An unexpected error interrupted the show."}
      </p>
      <div className="mt-6 flex gap-3">
        <button className="btn-primary" onClick={reset}>
          Try again
        </button>
        <a href="/dashboard" className="btn-secondary">
          Back to Tonight
        </a>
      </div>
    </div>
  );
}
