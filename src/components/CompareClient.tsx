"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppNav } from "@/components/AppNav";
import { PickCard } from "@/components/PickCard";
import type { OverlapStats } from "@/lib/compareStats";
import { usePosters } from "@/lib/usePosters";
import {
  LETTERBOXD_FILM_URL,
  type Pick,
  type RecommendResponse,
} from "@/lib/types";

interface Props {
  username: string;
  activeSession: { id: string; joinCode: string; isOwner: boolean } | null;
  overlap: OverlapStats | null;
}

export function CompareClient({ username, activeSession, overlap }: Props) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [guestUsername, setGuestUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [pickSource, setPickSource] = useState<"ai" | "deterministic" | null>(null);
  const posters = usePosters(
    (picks ?? []).map((p) => ({ slug: p.slug, title: p.title, year: p.year }))
  );

  async function createSession() {
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create session");
      router.push(`/compare?session=${json.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setBusy(null);
    }
  }

  async function joinSession(e: React.FormEvent) {
    e.preventDefault();
    setBusy("join");
    setError(null);
    try {
      const res = await fetch("/api/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not join");
      router.push(`/compare?session=${json.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(null);
    }
  }

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSession) return;
    setBusy("guest");
    setError(null);
    try {
      const res = await fetch("/api/sessions/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id, username: guestUsername }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add profile");
      setGuestUsername("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add profile");
    } finally {
      setBusy(null);
    }
  }

  async function compromisePicks() {
    if (!activeSession) return;
    setBusy("picks");
    setError(null);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            mood: "easy",
            intensity: "medium",
            runtimeCap: "any",
            language: "any",
            allowRewatches: false,
          },
          count: 8,
          sessionId: activeSession.id,
        }),
      });
      const json: RecommendResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not get picks");
      setPicks(json.picks);
      setPickSource(json.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get picks");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav active="compare" />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="animate-fade-up text-2xl font-bold text-white">Compare</h1>
        <p className="animate-fade-up text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Find a film that works for everyone — up to 3 profiles.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {!activeSession ? (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-white">Start a session</h2>
            <p className="mt-1 text-sm text-night-400">
              You&apos;ll get a 6-letter code your friends can use to join with their own library.
            </p>
            <button
              className="btn-primary mt-3 w-full"
              onClick={createSession}
              disabled={busy !== null}
            >
              {busy === "create" ? "Creating…" : "Create session"}
            </button>
          </div>
          <div className="card">
            <h2 className="font-semibold text-white">Join a session</h2>
            <form className="mt-3 flex gap-2" onSubmit={joinSession}>
              <input
                className="input flex-1 uppercase tracking-widest"
                placeholder="ABC123"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy !== null || joinCode.length !== 6}
              >
                {busy === "join" ? "Joining…" : "Join"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-night-400">Share this join code</p>
              <p className="text-2xl font-bold tracking-[0.3em] text-accent">
                {activeSession.joinCode}
              </p>
            </div>
            <div className="text-right text-sm text-night-400">
              {overlap?.members.length ?? 1}/3 profiles
              <br />
              You: @{username}
            </div>
          </div>

          {activeSession.isOwner && (overlap?.members.length ?? 1) < 3 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white">
                Add a friend without an account
              </h2>
              <p className="mt-1 text-xs text-night-400">
                Just their Letterboxd username — we pull their recent public activity
                automatically. Their account must be public.
              </p>
              <form className="mt-3 flex gap-2" onSubmit={addGuest}>
                <input
                  className="input flex-1"
                  placeholder="letterboxd username"
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value.trim())}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy !== null || !guestUsername}
                >
                  {busy === "guest" ? "Adding…" : "Add"}
                </button>
              </form>
            </div>
          )}

          {overlap && (
            <>
              <div className="card">
                <h2 className="mb-3 text-sm font-semibold text-white">Profiles</h2>
                <ul className="space-y-1 text-sm">
                  {overlap.members.map((m) => (
                    <li key={m.username} className="flex justify-between">
                      <span className="text-slate-300">
                        @{m.username}
                        {m.isGuest && (
                          <span className="ml-2 rounded bg-night-700 px-1.5 py-0.5 text-[10px] uppercase text-night-400">
                            Guest
                          </span>
                        )}
                      </span>
                      <span className="text-night-400">{m.filmCount} films</span>
                    </li>
                  ))}
                </ul>
              </div>

              {overlap.members.length >= 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="card">
                    <h2 className="mb-2 text-sm font-semibold text-white">Rating similarity</h2>
                    {overlap.ratingSimilarity.every((r) => r.sharedRated === 0) ? (
                      <p className="text-xs text-night-400">
                        No films rated by multiple people yet.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {overlap.ratingSimilarity.map((r) => (
                          <li key={r.pair} className="flex justify-between">
                            <span className="text-slate-300">{r.pair}</span>
                            <span className="text-accent">
                              {r.sharedRated > 0 ? `${r.similarityPct}%` : "—"}
                              <span className="ml-1 text-xs text-night-400">
                                ({r.sharedRated} shared)
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="card">
                    <h2 className="mb-2 text-sm font-semibold text-white">Shared decades</h2>
                    {overlap.sharedTopDecades.length === 0 ? (
                      <p className="text-xs text-night-400">No overlapping decades yet.</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {overlap.sharedTopDecades.map((d) => (
                          <li key={d.decade} className="flex justify-between">
                            <span className="text-slate-300">{d.decade}</span>
                            <span className="text-night-400">{d.count} watches</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {overlap.sharedFilms.length > 0 && (
                <div className="card">
                  <h2 className="mb-2 text-sm font-semibold text-white">
                    In everyone&apos;s library ({overlap.sharedFilms.length})
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {overlap.sharedFilms.map((f) => (
                      <li key={f.slug}>
                        <a
                          href={LETTERBOXD_FILM_URL(f.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="chip hover:border-accent"
                        >
                          {f.title} {f.year && <span className="text-night-400">({f.year})</span>}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                className="btn-primary w-full"
                onClick={compromisePicks}
                disabled={busy !== null || overlap.members.length < 2}
              >
                {busy === "picks"
                  ? "Finding compromise…"
                  : overlap.members.length < 2
                    ? "Waiting for a second profile…"
                    : "Generate compromise picks"}
              </button>

              {picks && (
                <>
                  {pickSource === "deterministic" && (
                    <p className="text-xs text-night-400">
                      Picks from overlap stats (AI polish unavailable right now).
                    </p>
                  )}
                  {picks.length === 0 ? (
                    <p className="text-center text-sm text-night-400">
                      No shared candidates yet — add more films or another profile.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {picks.map((p, i) => (
                        <PickCard key={p.slug} pick={p} posterUrl={posters[p.slug]} index={i} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
      </main>
    </div>
  );
}
