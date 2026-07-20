"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppNav } from "@/components/AppNav";
import { LETTERBOXD_FILM_URL, type TasteSnapshot } from "@/lib/types";

export interface FriendSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
  filmCount: number;
  recentWatches: { title: string; year: number | null; slug: string; watched_date: string | null }[];
  topRated: { title: string; year: number | null; slug: string; rating: number }[];
  build: { level: number; title: string; tier: string };
}

export interface Badge {
  id: string;
  label: string;
  desc: string;
  earned: boolean;
}

export interface ReviewItem {
  slug: string;
  title: string;
  year: number | null;
  rating: number | null;
  watched_date: string | null;
  review: string;
}

interface Props {
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  lastSyncedAt: string | null;
  snapshot: TasteSnapshot;
  friends: FriendSummary[];
  reviews: ReviewItem[];
  badges: Badge[];
}

function Avatar({
  url,
  name,
  size = "h-16 w-16 text-2xl",
}: {
  url: string | null;
  name: string;
  size?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={`${name} avatar`}
        className={`${size} rounded-full object-cover ring-2 ring-accent/40`}
      />
    );
  }
  return (
    <div
      className={`${size} flex items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-accent-blue/30 font-black text-white`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ProfileClient({
  username,
  avatarUrl,
  memberSince,
  lastSyncedAt,
  snapshot,
  friends,
  reviews,
  badges,
}: Props) {
  const router = useRouter();
  const [friendName, setFriendName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [openFriend, setOpenFriend] = useState<string | null>(null);

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: friendName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add friend");
      setNotice(
        json.filmsImported > 0
          ? `Added @${friendName} — pulled ${json.filmsImported} of their recent films`
          : `Added @${friendName} — their public activity looks empty so far`
      );
      setFriendName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add friend");
    } finally {
      setBusy(null);
    }
  }

  async function removeFriend(friendId: string, name: string) {
    setBusy(friendId);
    setError(null);
    try {
      const res = await fetch("/api/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not remove friend");
      setNotice(`Removed @${name}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove friend");
    } finally {
      setBusy(null);
    }
  }

  async function onAvatarFile(file: File | undefined) {
    if (!file) return;
    setBusy("avatar");
    setError(null);
    try {
      // Crop to a square and shrink client-side so the stored image is tiny.
      const bitmap = await createImageBitmap(file);
      const size = 192;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not save photo");
      setNotice("Profile photo updated");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save photo");
    } finally {
      setBusy(null);
    }
  }

  async function resetLibrary() {
    setBusy("reset");
    try {
      await fetch("/api/profile/reset", { method: "POST" });
      router.push("/setup");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav active="profile" />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Identity */}
        <header className="animate-fade-up mb-6 flex items-center gap-4">
          <label className="group relative cursor-pointer" title="Change photo">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatarFile(e.target.files?.[0])}
            />
            <Avatar url={avatarUrl} name={username} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-[10px] font-bold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
              {busy === "avatar" ? "Saving…" : "Edit"}
            </span>
          </label>
          <div>
            <h1 className="text-2xl font-bold text-white">@{username}</h1>
            <p className="text-xs text-night-400">
              Member since {new Date(memberSince).toLocaleDateString()}
              {lastSyncedAt && <> · library updated {new Date(lastSyncedAt).toLocaleString()}</>}
            </p>
            <p className="mt-0.5 text-[11px] text-night-400">Tap the circle to set a photo</p>
          </div>
        </header>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
            {notice}
          </p>
        )}

        {/* Stats */}
        <section className="animate-fade-up mb-6" style={{ animationDelay: "60ms" }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Films" value={snapshot.totalFilms} />
            <Stat label="Rated" value={snapshot.totalRated} />
            <Stat
              label="Avg rating"
              value={snapshot.averageRating !== null ? `${snapshot.averageRating}★` : "—"}
            />
            <Stat label="Watchlist" value={snapshot.watchlistCount} />
          </div>
        </section>

        {/* Achievements */}
        <section className="animate-fade-up mb-6" style={{ animationDelay: "90ms" }}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-400">
            Achievements ({badges.filter((b) => b.earned).length}/{badges.length})
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {badges.map((b, i) => (
              <div
                key={b.id}
                className={`animate-fade-up rounded-lg border p-2.5 ${
                  b.earned
                    ? "border-accent/40 bg-accent/5"
                    : "border-night-700/60 bg-night-900 opacity-50"
                }`}
                style={{ animationDelay: `${100 + i * 40}ms` }}
                title={b.desc}
              >
                <p className={`text-sm font-bold ${b.earned ? "text-accent" : "text-slate-400"}`}>
                  {b.earned ? "◆" : "◇"} {b.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-night-400">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Taste snapshot — collapsed by default */}
        <Collapsible title="Taste snapshot" delay={120}>
          <div className="space-y-4">
            {snapshot.topDecades.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-night-400">
                  Top decades
                </p>
                <div className="flex flex-wrap gap-2">
                  {snapshot.topDecades.map((d) => (
                    <span key={d.decade} className="chip">
                      {d.decade} · {d.count} films
                    </span>
                  ))}
                  {snapshot.mostWatchedYear && (
                    <span className="chip">
                      Peak year {snapshot.mostWatchedYear.year} ({snapshot.mostWatchedYear.count})
                    </span>
                  )}
                </div>
              </div>
            )}
            <SnapshotList
              title="Recent watches"
              items={snapshot.recentWatches.map((f) => ({
                slug: f.slug,
                title: f.title,
                detail: `${f.year ?? ""} · ${f.watched_date}`,
              }))}
            />
            <SnapshotList
              title="Top rated"
              items={snapshot.topRated.map((f) => ({
                slug: f.slug,
                title: f.title,
                detail: `${f.rating}★`,
              }))}
            />
          </div>
        </Collapsible>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="mt-6">
            <Collapsible title={`Your reviews (${reviews.length})`} delay={150}>
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li key={`${r.slug}-${r.watched_date}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <a
                        href={LETTERBOXD_FILM_URL(r.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-white hover:text-accent"
                      >
                        {r.title}
                        {r.year && <span className="ml-1.5 text-sm text-night-400">{r.year}</span>}
                      </a>
                      <span className="shrink-0 text-xs text-night-400">
                        {r.rating !== null && <span className="text-accent">{r.rating}★ </span>}
                        {r.watched_date}
                      </span>
                    </div>
                    <blockquote className="mt-1 border-l-2 border-night-700 pl-3 text-sm italic leading-relaxed text-slate-300">
                      {r.review.length > 300 ? `${r.review.slice(0, 300)}…` : r.review}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </Collapsible>
          </div>
        )}

        {/* Friends */}
        <section className="animate-fade-up mt-6" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-400">
            Friends ({friends.length})
          </h2>
          <form onSubmit={addFriend} className="card mb-3 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Friend's Letterboxd username"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value.trim())}
            />
            <button type="submit" className="btn-primary" disabled={busy !== null || !friendName}>
              {busy === "add" ? "Adding…" : "Add"}
            </button>
          </form>
          {friends.length === 0 ? (
            <p className="text-sm text-night-400">
              Add friends by username to see their recent films and taste — and find films you both
              want to watch in{" "}
              <Link href="/compare" className="text-accent hover:underline">
                Compare
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {friends.map((f) => (
                <li key={f.id} className="card">
                  <button
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => setOpenFriend(openFriend === f.id ? null : f.id)}
                  >
                    <Avatar url={f.avatarUrl} name={f.username} size="h-10 w-10 text-base" />
                    <span className="flex-1">
                      <span className="block font-semibold text-white">@{f.username}</span>
                      <span className="text-xs text-night-400">
                        {f.filmCount} films from their public activity
                      </span>
                      <span className="mt-1 inline-block rounded bg-night-800 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                        Lv {f.build.level} · {f.build.title} · {f.build.tier} tier
                      </span>
                    </span>
                    <span className="text-night-400">{openFriend === f.id ? "▴" : "▾"}</span>
                  </button>
                  {openFriend === f.id && (
                    <div className="animate-fade-up mt-3 space-y-3 border-t border-night-700/60 pt-3">
                      <SnapshotList
                        title="Recently watched"
                        items={f.recentWatches.map((w) => ({
                          slug: w.slug,
                          title: w.title,
                          detail: w.watched_date ?? "",
                        }))}
                      />
                      <SnapshotList
                        title="Their top rated"
                        items={f.topRated.map((w) => ({
                          slug: w.slug,
                          title: w.title,
                          detail: `${w.rating}★`,
                        }))}
                      />
                      <div className="flex gap-2">
                        <a
                          href={`https://letterboxd.com/${f.username}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary flex-1 text-xs"
                        >
                          Letterboxd profile →
                        </a>
                        <button
                          className="btn-secondary flex-1 text-xs text-red-300"
                          onClick={() => removeFriend(f.id, f.username)}
                          disabled={busy === f.id}
                        >
                          {busy === f.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Library tools */}
        <section className="animate-fade-up mt-8" style={{ animationDelay: "240ms" }}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-night-400">
            Library
          </h2>
          <div className="card space-y-2">
            <p className="text-xs text-night-400">
              Your library updates itself with new watches. Re-import only if you want a fresh full
              export (e.g. to pull in older ratings).
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/setup" className="btn-secondary flex-1 text-xs">
                Re-import export
              </Link>
              {confirmingReset ? (
                <div className="flex flex-1 gap-2">
                  <button
                    className="btn-secondary flex-1 text-xs"
                    onClick={() => setConfirmingReset(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn flex-1 bg-red-500/80 text-xs text-white hover:bg-red-500"
                    onClick={resetLibrary}
                    disabled={busy === "reset"}
                  >
                    {busy === "reset" ? "Deleting…" : "Confirm delete"}
                  </button>
                </div>
              ) : (
                <button
                  className="btn-secondary flex-1 text-xs text-red-300"
                  onClick={() => setConfirmingReset(true)}
                >
                  Reset library
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Eased count-up for numeric stats — the tiles feel alive on page load. */
function useCountUp(target: number, ms = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let raf: number;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  const numeric = typeof value === "number";
  const counted = useCountUp(numeric ? value : 0);
  return (
    <div className="rounded-lg bg-night-900 p-3 transition-colors hover:bg-night-800">
      <p className="text-xs text-night-400">{label}</p>
      <p className="text-xl font-bold tabular-nums text-white">{numeric ? counted : value}</p>
    </div>
  );
}

function Collapsible({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <button
        className="card flex w-full items-center justify-between py-3"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-bold uppercase tracking-wider text-night-400">{title}</span>
        <span className="text-night-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="card animate-fade-up mt-2">{children}</div>}
    </section>
  );
}

function SnapshotList({
  title,
  items,
}: {
  title: string;
  items: { slug: string; title: string; detail: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-night-400">{title}</p>
      <ul className="space-y-1">
        {items.slice(0, 8).map((item, i) => (
          <li key={`${item.slug}-${i}`} className="flex items-baseline justify-between gap-2 text-sm">
            <a
              href={LETTERBOXD_FILM_URL(item.slug)}
              target="_blank"
              rel="noreferrer"
              className="truncate text-slate-300 hover:text-accent"
            >
              {item.title}
            </a>
            <span className="shrink-0 text-xs text-night-400">{item.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
