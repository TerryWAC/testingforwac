"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PickCard } from "@/components/PickCard";
import { usePosters } from "@/lib/usePosters";
import {
  LETTERBOXD_FILM_URL,
  type Intensity,
  type LanguagePref,
  type Mood,
  type Pick,
  type RecommendResponse,
  type RuntimeCap,
  type TasteSnapshot,
} from "@/lib/types";

interface Props {
  username: string;
  snapshot: TasteSnapshot;
  lastSyncedAt: string | null;
  syncStale: boolean;
}

const MOODS: { value: Mood; label: string }[] = [
  { value: "comedy", label: "Comedy night" },
  { value: "date", label: "Date night" },
  { value: "thriller", label: "Thriller" },
  { value: "weird", label: "Weird" },
  { value: "easy", label: "Easy watch" },
];
const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];
const RUNTIMES: { value: RuntimeCap; label: string }[] = [
  { value: "under90", label: "Under 90" },
  { value: "under120", label: "Under 120" },
  { value: "any", label: "Any" },
];
const LANGUAGES: { value: LanguagePref; label: string }[] = [
  { value: "english", label: "English only" },
  { value: "any", label: "Any" },
];

export function DashboardClient({ username, snapshot, lastSyncedAt, syncStale }: Props) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<"tonight" | "chat">("tonight");

  const [mood, setMood] = useState<Mood>("easy");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [runtimeCap, setRuntimeCap] = useState<RuntimeCap>("any");
  const [language, setLanguage] = useState<LanguagePref>("any");
  const [allowRewatches, setAllowRewatches] = useState(false);

  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [pickSource, setPickSource] = useState<"ai" | "deterministic" | null>(null);
  const [busy, setBusy] = useState<"recommend" | "surprise" | "sync" | "chat" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const posters = usePosters(
    (picks ?? []).map((p) => ({ slug: p.slug, title: p.title, year: p.year }))
  );

  // Chat state
  const [chatLog, setChatLog] = useState<{ role: "user" | "app"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatQuestionsAsked = useRef(0);

  // Auto-sync in the background when the library is stale, so users never
  // have to think about updating — RSS keeps things fresh.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (syncStale && !autoSynced.current) {
      autoSynced.current = true;
      fetch("/api/sync", { method: "POST" })
        .then((r) => r.json())
        .then((json) => {
          if (typeof json.added === "number" && json.added > 0) {
            setSyncMessage(`Auto-synced ${json.added} new ${json.added === 1 ? "entry" : "entries"} from RSS`);
            router.refresh();
          }
        })
        .catch(() => {});
    }
  }, [syncStale, router]);

  async function getPicks(count: 1 | 8, chatMessage?: string) {
    setBusy(chatMessage ? "chat" : count === 1 ? "surprise" : "recommend");
    setError(null);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { mood, intensity, runtimeCap, language, allowRewatches },
          count,
          chatMessage,
        }),
      });
      const json: RecommendResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not get picks");
      setPicks(json.picks);
      setPickSource(json.source);
      if (chatMessage) {
        setChatLog((log) => [
          ...log,
          {
            role: "app",
            text: json.followUp
              ? json.followUp
              : `Here ${json.picks.length === 1 ? "is my pick" : `are ${json.picks.length} picks`} — see below!`,
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      setSyncMessage(
        json.added > 0
          ? `Added ${json.added} new ${json.added === 1 ? "entry" : "entries"} from RSS`
          : "Library already up to date"
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  }

  function sendChat() {
    const message = chatInput.trim();
    if (!message) return;
    setChatInput("");
    setChatLog((log) => [...log, { role: "user", text: message }]);

    // Guided flow: ask up to 2 quick follow-ups before hitting the engine.
    if (chatQuestionsAsked.current === 0) {
      chatQuestionsAsked.current = 1;
      setChatLog((log) => [
        ...log,
        {
          role: "app",
          text: "Nice — what's the vibe tonight? (e.g. comedy, date night, thriller, something weird, easy watch)",
        },
      ]);
      return;
    }
    if (chatQuestionsAsked.current === 1) {
      chatQuestionsAsked.current = 2;
      const m = message.toLowerCase();
      if (m.includes("comed")) setMood("comedy");
      else if (m.includes("date")) setMood("date");
      else if (m.includes("thrill")) setMood("thriller");
      else if (m.includes("weird")) setMood("weird");
      else setMood("easy");
      setChatLog((log) => [
        ...log,
        { role: "app", text: "Got it. How much time do you have — under 90, under 2 hours, or no limit?" },
      ]);
      return;
    }
    const m = message.toLowerCase();
    if (m.includes("90")) setRuntimeCap("under90");
    else if (m.includes("120") || m.includes("2 hour") || m.includes("two hour")) setRuntimeCap("under120");
    else setRuntimeCap("any");
    chatQuestionsAsked.current = 0;
    void getPicks(8, message);
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform overflow-y-auto border-r border-night-700/60 bg-night-900 p-5 transition-transform lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-night-400">Signed in as</p>
            <p className="font-semibold text-white">@{username}</p>
          </div>
          <button
            className="rounded-lg p-2 text-night-400 hover:bg-night-800 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* Taste snapshot */}
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-night-400">
            Taste snapshot
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-night-800 p-3">
              <p className="text-xs text-night-400">Films</p>
              <p className="text-lg font-bold text-white">{snapshot.totalFilms}</p>
            </div>
            <div className="rounded-lg bg-night-800 p-3">
              <p className="text-xs text-night-400">Avg rating</p>
              <p className="text-lg font-bold text-white">
                {snapshot.averageRating ?? "—"}
                {snapshot.averageRating ? "★" : ""}
              </p>
            </div>
            <div className="rounded-lg bg-night-800 p-3">
              <p className="text-xs text-night-400">Watchlist</p>
              <p className="text-lg font-bold text-white">{snapshot.watchlistCount}</p>
            </div>
            <div className="rounded-lg bg-night-800 p-3">
              <p className="text-xs text-night-400">Top decade</p>
              <p className="text-lg font-bold text-white">
                {snapshot.topDecades[0]?.decade ?? "—"}
              </p>
            </div>
          </div>
          {snapshot.mostWatchedYear && (
            <p className="mt-2 text-xs text-night-400">
              Most watched year: {snapshot.mostWatchedYear.year} ({snapshot.mostWatchedYear.count}{" "}
              films)
            </p>
          )}
        </section>

        {/* Recent watches */}
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-night-400">
            Recent watches
          </h2>
          {snapshot.recentWatches.length === 0 ? (
            <p className="text-xs text-night-400">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {snapshot.recentWatches.map((f, i) => (
                <li key={`${f.slug}-${i}`} className="text-sm">
                  <a
                    href={LETTERBOXD_FILM_URL(f.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-300 hover:text-accent"
                  >
                    {f.title}
                  </a>{" "}
                  <span className="text-xs text-night-400">
                    {f.year ?? ""} · {f.watched_date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Top rated */}
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-night-400">
            Top rated
          </h2>
          {snapshot.topRated.length === 0 ? (
            <p className="text-xs text-night-400">No ratings imported yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {snapshot.topRated.map((f, i) => (
                <li key={`${f.slug}-${i}`} className="flex items-baseline justify-between text-sm">
                  <a
                    href={LETTERBOXD_FILM_URL(f.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-slate-300 hover:text-accent"
                  >
                    {f.title}
                  </a>
                  <span className="ml-2 shrink-0 text-xs text-accent">{f.rating}★</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ProfileTools />
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main panel */}
      <main className="flex-1 px-4 py-6 sm:px-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border border-night-700 p-2 text-slate-300 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <h1 className="text-xl font-bold text-white">Tonight</h1>
          </div>
          <nav className="flex items-center gap-1.5 overflow-x-auto">
            <Link href="/wheel" className="btn-secondary shrink-0 text-xs">
              Wheel
            </Link>
            <Link href="/match" className="btn-secondary shrink-0 text-xs">
              Match
            </Link>
            <Link href="/double" className="btn-secondary shrink-0 text-xs">
              Double
            </Link>
            <Link href="/compare" className="btn-secondary shrink-0 text-xs">
              Compare
            </Link>
            <button
              className="btn-secondary shrink-0 text-xs"
              onClick={syncNow}
              disabled={busy === "sync"}
            >
              {busy === "sync" ? "Syncing…" : "Sync RSS"}
            </button>
          </nav>
        </header>

        {syncMessage && (
          <p className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
            {syncMessage}
          </p>
        )}
        {lastSyncedAt && !syncMessage && (
          <p className="mb-4 text-xs text-night-400">
            Library auto-updates from RSS · last synced {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-night-900 p-1">
          {(["tonight", "chat"] as const).map((t) => (
            <button
              key={t}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t ? "bg-night-700 text-white" : "text-night-400 hover:text-slate-300"
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "tonight" && (
          <section className="card mb-6 space-y-4">
            <FilterRow label="Mood">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  className={`chip ${mood === m.value ? "chip-active" : "hover:border-night-400"}`}
                  onClick={() => setMood(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </FilterRow>
            <FilterRow label="Intensity">
              {INTENSITIES.map((i) => (
                <button
                  key={i.value}
                  className={`chip ${intensity === i.value ? "chip-active" : "hover:border-night-400"}`}
                  onClick={() => setIntensity(i.value)}
                >
                  {i.label}
                </button>
              ))}
            </FilterRow>
            <FilterRow label="Runtime">
              {RUNTIMES.map((r) => (
                <button
                  key={r.value}
                  className={`chip ${runtimeCap === r.value ? "chip-active" : "hover:border-night-400"}`}
                  onClick={() => setRuntimeCap(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </FilterRow>
            <FilterRow label="Language">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  className={`chip ${language === l.value ? "chip-active" : "hover:border-night-400"}`}
                  onClick={() => setLanguage(l.value)}
                >
                  {l.label}
                </button>
              ))}
            </FilterRow>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={allowRewatches}
                onChange={(e) => setAllowRewatches(e.target.checked)}
                className="h-4 w-4 accent-[#00c030]"
              />
              Allow rewatches
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="btn-primary flex-1"
                onClick={() => getPicks(8)}
                disabled={busy !== null}
              >
                {busy === "recommend" ? "Picking…" : "Recommend"}
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => getPicks(1)}
                disabled={busy !== null}
              >
                {busy === "surprise" ? "Rolling…" : "Surprise me"}
              </button>
            </div>
          </section>
        )}

        {tab === "chat" && (
          <section className="card mb-6">
            <div className="mb-3 max-h-72 space-y-2 overflow-y-auto">
              {chatLog.length === 0 && (
                <p className="text-sm text-night-400">
                  Try: &ldquo;We want a film tonight&rdquo; — I&apos;ll ask a couple of quick
                  questions, then pick from your library.
                </p>
              )}
              {chatLog.map((entry, i) => (
                <p
                  key={i}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    entry.role === "user"
                      ? "ml-auto bg-accent/15 text-accent"
                      : "bg-night-800 text-slate-200"
                  }`}
                >
                  {entry.text}
                </p>
              ))}
              {busy === "chat" && <p className="text-xs text-night-400">Thinking…</p>}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input
                className="input flex-1"
                placeholder="We want a film tonight…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={busy !== null}>
                Send
              </button>
            </form>
          </section>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Picks */}
        {picks === null && snapshot.totalFilms === 0 && snapshot.watchlistCount === 0 ? (
          <div className="card text-center">
            <p className="font-semibold text-white">Your library is empty</p>
            <p className="mt-1 text-sm text-night-400">
              Import your Letterboxd export to get personalized picks.
            </p>
            <Link href="/setup" className="btn-primary mt-4 inline-flex">
              Import library
            </Link>
          </div>
        ) : picks === null ? (
          <p className="text-center text-sm text-night-400">
            Set the vibe above and hit <span className="text-accent">Recommend</span> — picks come
            from your own watchlist and library.
          </p>
        ) : picks.length === 0 ? (
          <div className="card text-center">
            <p className="font-semibold text-white">No matches with these filters</p>
            <p className="mt-1 text-sm text-night-400">
              Try allowing rewatches or loosening the filters — or add films to your Letterboxd
              watchlist and sync.
            </p>
          </div>
        ) : (
          <>
            {pickSource === "deterministic" && (
              <p className="mb-3 text-xs text-night-400">
                Picks from your library stats (AI polish unavailable right now).
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {picks.map((p, i) => (
                <PickCard key={p.slug} pick={p} posterUrl={posters[p.slug]} index={i} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-night-400">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ProfileTools() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function resetProfile() {
    setBusy(true);
    try {
      await fetch("/api/profile/reset", { method: "POST" });
      router.push("/setup");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-t border-night-700/60 pt-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-night-400">Profile</h2>
      <div className="space-y-2">
        <Link href="/setup" className="btn-secondary w-full text-xs">
          Re-import ZIP
        </Link>
        {confirming ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="mb-2 text-xs text-red-300">
              Delete all imported films? You can re-import any time.
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-xs" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                className="btn flex-1 bg-red-500/80 text-xs text-white hover:bg-red-500"
                onClick={resetProfile}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-secondary w-full text-xs text-red-300"
            onClick={() => setConfirming(true)}
          >
            Reset profile
          </button>
        )}
      </div>
    </section>
  );
}
