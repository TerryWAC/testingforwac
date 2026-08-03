/**
 * Required notices.
 *
 * TMDB's API terms require an attribution stating the product isn't endorsed
 * by them, and the app's name references Letterboxd without any affiliation —
 * both need saying plainly somewhere a user can see before signing up.
 */
export function Attribution({ className = "" }: { className?: string }) {
  return (
    <footer className={`text-center text-[11px] leading-relaxed text-night-400 ${className}`}>
      <p>
        Not affiliated with, endorsed by, or connected to Letterboxd. Your library stays yours —
        imported from your own export and never shared.
      </p>
      <p className="mt-1.5">
        This product uses the{" "}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noreferrer"
          className="text-night-400 underline decoration-night-700 underline-offset-2 hover:text-accent"
        >
          TMDB
        </a>{" "}
        API but is not endorsed or certified by TMDB.
      </p>
    </footer>
  );
}
