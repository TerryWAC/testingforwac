"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { PickCard } from "@/components/PickCard";
import { warmCandidates } from "@/lib/candidatesCache";
import { usePosters } from "@/lib/usePosters";
import {
  LETTERBOXD_FILM_URL,
  type Era,
  type Intensity,
  type LanguagePref,
  type Mood,
  type Pick,
  type RecommendResponse,
  type RuntimeCap,
  type TasteSnapshot,
} from "@/lib/types";

export interface Memory {
  slug: string;
  title: string;
  year: number | null;
  watchedYear: number;
  yearsAgo: number;
}

interface Props {
  username: string;
  snapshot: TasteSnapshot;
  lastSyncedAt: string | null;
  syncStale: boolean;
  memories: Memory[];
}

const MOODS: { value: Mood; label: string }[] = [
  { value: "easy", label: "Easy watch" },
  { value: "comedy", label: "Comedy" },
  { value: "date", label: "Date night" },
  { value: "thriller", label: "Thriller" },
  { value: "horror", label: "Horror" },
  { value: "action", label: "Action" },
  { value: "romance", label: "Romance" },
  { value: "weird", label: "Weird" },
  { value: "mindbender", label: "Mind-bender" },
  { value: "feelgood", label: "Feel-good" },
  { value: "tearjerker", label: "Tearjerker" },
  { value: "classic", label: "Classic" },
];
const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "extreme", label: "Extreme" },
];
const RUNTIMES: { value: RuntimeCap; label: string }[] = [
  { value: "under90", label: "Under 1h 30m" },
  { value: "under105", label: "Under 1h 45m" },
  { value: "under120", label: "Under 2h" },
  { value: "under150", label: "Under 2h 30m" },
  { value: "any", label: "Any length" },
];
const LANGUAGES: { value: LanguagePref; label: string }[] = [
  { value: "any", label: "Any language" },
  { value: "english", label: "English only" },
  { value: "foreign", label: "Foreign / subtitled" },
];
const ERAS: { value: Era; label: string }[] = [
  { value: "any", label: "Any era" },
  { value: "2020s", label: "2020s" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "1990s", label: "1990s" },
  { value: "1980s", label: "1980s" },
  { value: "1970s", label: "1970s" },
  { value: "pre1970", label: "Pre-1970" },
];

export function DashboardClient({ snapshot, lastSyncedAt, syncStale, memories }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"tonight" | "chat">("tonight");

  const [mood, setMood] = useState<Mood>("easy");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [runtimeCap, setRuntimeCap] = useState<RuntimeCap>("any");
  const [language, setLanguage] = useState<LanguagePref>("any");
  const [era, setEra] = useState<Era>("any");
  const [allowRewatches, setAllowRewatches] = useState(false);
  const [finishBy, setFinishBy] = useState("");

  // Curfew mode: pick a finish time and we work out the runtime cap for you.
  function applyCurfew(time: string) {
    setFinishBy(time);
    if (!time) return;
    const [h, m] = time.split(":").map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // past midnight
    const minutes = Math.round((target.getTime() - now.getTime()) / 60000);
    if (minutes <= 95) setRuntimeCap("under90");
    else if (minutes <= 110) setRuntimeCap("under105");
    else if (minutes <= 130) setRuntimeCap("under120");
    else if (minutes <= 160) setRuntimeCap("under150");
    else setRuntimeCap("any");
  }

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

  // Warm the candidate cache so Wheel / Match / Final Cut open instantly.
  useEffect(() => {
    warmCandidates();
  }, []);

  // Keep the library fresh silently — users never think about updates.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (syncStale && !autoSynced.current) {
      autoSynced.current = true;
      fetch("/api/sync", { method: "POST" })
        .then((r) => r.json())
        .then((json) => {
          if (typeof json.added === "number" && json.added > 0) {
            setSyncMessage(
              `Found ${json.added} new ${json.added === 1 ? "watch" : "watches"} — library updated automatically`
            );
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
          filters: { mood, intensity, runtimeCap, language, era, allowRewatches },
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
      if (!res.ok) throw new Error(json.error ?? "Refresh failed");
      setSyncMessage(
        json.added > 0
          ? `Added ${json.added} new ${json.added === 1 ? "watch" : "watches"}`
          : "Library already up to date"
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(null);
    }
  }

  function sendChat() {
    const message = chatInput.trim();
    if (!message) return;
    setChatInput("");
    setChatLog((log) => [...log, { role: "user", text: message }]);

    if (chatQuestionsAsked.current === 0) {
      chatQuestionsAsked.current = 1;
      setChatLog((log) => [
        ...log,
        {
          role: "app",
          text: "Nice — what's the vibe tonight? (comedy, date night, thriller, horror, something weird, feel-good…)",
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
      else if (m.includes("horror") || m.includes("scary")) setMood("horror");
      else if (m.includes("action")) setMood("action");
      else if (m.includes("roman")) setMood("romance");
      else if (m.includes("weird")) setMood("weird");
      else if (m.includes("mind")) setMood("mindbender");
      else if (m.includes("feel")) setMood("feelgood");
      else if (m.includes("cry") || m.includes("tear") || m.includes("sad")) setMood("tearjerker");
      else if (m.includes("classic") || m.includes("old")) setMood("classic");
      else setMood("easy");
      setChatLog((log) => [
        ...log,
        { role: "app", text: "Got it. How much time do you have — under 90, under 2 hours, or no limit?" },
      ]);
      return;
    }
    const m = message.toLowerCase();
    if (m.includes("90")) setRuntimeCap("under90");
    else if (m.includes("105")) setRuntimeCap("under105");
    else if (m.includes("150") || m.includes("2.5") || m.includes("long")) setRuntimeCap("under150");
    else if (m.includes("120") || m.includes("2 hour") || m.includes("two hour")) setRuntimeCap("under120");
    else setRuntimeCap("any");
    chatQuestionsAsked.current = 0;
    void getPicks(8, message);
  }

  return (
    <div className="min-h-screen">
      <AppNav active="dashboard" />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="animate-fade-up text-xl font-bold text-white">Tonight</h1>
          <button className="btn-secondary text-xs" onClick={syncNow} disabled={busy === "sync"}>
            {busy === "sync" ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {syncMessage && (
          <p className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
            {syncMessage}
          </p>
        )}
        {lastSyncedAt && !syncMessage && (
          <p className="mb-4 text-xs text-night-400">
            Library updates itself · last updated {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}

        {memories.length > 0 && (
          <div className="animate-fade-up mb-4 rounded-lg border border-accent-blue/25 bg-accent-blue/5 px-3 py-2 text-xs text-slate-300">
            <span className="font-bold uppercase tracking-wider text-accent-blue">
              On this day
            </span>{" "}
            {memories.slice(0, 2).map((m, i) => (
              <span key={`${m.slug}-${m.watchedYear}`}>
                {i > 0 && " · "}
                {m.yearsAgo} {m.yearsAgo === 1 ? "year" : "years"} ago you watched{" "}
                <a
                  href={LETTERBOXD_FILM_URL(m.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-white hover:text-accent"
                >
                  {m.title}
                </a>
              </span>
            ))}
          </div>
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
          <section className="card animate-fade-up mb-6 space-y-4 overflow-hidden">
            <FilterRow label="Mood">
              {MOODS.map((m) => (
                <Chip key={m.value} active={mood === m.value} onClick={() => setMood(m.value)}>
                  {m.label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Era">
              {ERAS.map((e) => (
                <Chip key={e.value} active={era === e.value} onClick={() => setEra(e.value)}>
                  {e.label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Intensity">
              {INTENSITIES.map((i) => (
                <Chip key={i.value} active={intensity === i.value} onClick={() => setIntensity(i.value)}>
                  {i.label}
                </Chip>
              ))}
            </FilterRow>
            <FilterRow label="Runtime">
              {RUNTIMES.map((r) => (
                <Chip
                  key={r.value}
                  active={runtimeCap === r.value}
                  onClick={() => {
                    setFinishBy("");
                    setRuntimeCap(r.value);
                  }}
                >
                  {r.label}
                </Chip>
              ))}
            </FilterRow>
            <div className="flex items-center gap-2 text-xs text-night-400">
              <span>or finish by</span>
              <input
                type="time"
                className="input w-auto px-2 py-1 text-xs"
                value={finishBy}
                onChange={(e) => applyCurfew(e.target.value)}
              />
              {finishBy && (
                <span className="text-accent">
                  {RUNTIMES.find((r) => r.value === runtimeCap)?.label} it is
                </span>
              )}
            </div>
            <FilterRow label="Language">
              {LANGUAGES.map((l) => (
                <Chip key={l.value} active={language === l.value} onClick={() => setLanguage(l.value)}>
                  {l.label}
                </Chip>
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
              <Link href="/slots" className="btn-secondary flex-1 text-center">
                Lucky Slots
              </Link>
            </div>
          </section>
        )}

        {tab === "chat" && (
          <section className="card animate-fade-up mb-6">
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
              Do the one-time import to get personalized picks.
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
              Try a different era, allow rewatches, or loosen the filters.
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
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`chip shrink-0 whitespace-nowrap transition-transform active:scale-95 ${
        active ? "chip-active" : "hover:border-night-400"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
