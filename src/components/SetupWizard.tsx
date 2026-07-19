"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ImportSummary } from "@/lib/types";

interface Props {
  existingProfile: { username: string; rssUrl: string } | null;
}

export function SetupWizard({ existingProfile }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(existingProfile?.username ?? "");
  const [rssUrl, setRssUrl] = useState(existingProfile?.rssUrl ?? "");
  const [rssTouched, setRssTouched] = useState(Boolean(existingProfile));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const effectiveRss =
    rssTouched && rssUrl
      ? rssUrl
      : username
        ? `https://letterboxd.com/${username}/rss/`
        : "";

  async function submit() {
    if (!file) {
      setError("Choose your Letterboxd export ZIP first.");
      return;
    }
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("username", username);
    form.set("rssUrl", effectiveRss);
    form.set("zip", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setSummary(json.summary);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Username", "Import", "Done"];

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= step ? "bg-accent text-night-950" : "bg-night-800 text-night-400"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-xs ${i <= step ? "text-slate-200" : "text-night-400"}`}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-night-700" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="card space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">
              Letterboxd username
            </span>
            <input
              className="input"
              placeholder="yourusername"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-300">RSS feed URL</span>
            <input
              className="input"
              value={effectiveRss}
              onChange={(e) => {
                setRssTouched(true);
                setRssUrl(e.target.value);
              }}
              placeholder="https://letterboxd.com/yourusername/rss/"
            />
            <span className="mt-1 block text-xs text-night-400">
              Auto-filled from your username — used to keep your library updated automatically.
            </span>
          </label>
          <button
            className="btn-primary w-full"
            disabled={!username || !effectiveRss}
            onClick={() => setStep(1)}
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-300">Upload your Letterboxd export</p>
            <p className="mt-1 text-xs text-night-400">
              Get it from{" "}
              <a
                href="https://letterboxd.com/user/exportdata"
                target="_blank"
                rel="noreferrer"
                className="text-accent-blue underline"
              >
                letterboxd.com/user/exportdata
              </a>{" "}
              (Settings → Data → Export your data). Upload the ZIP as-is.
            </p>
          </div>
          <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-night-700 px-4 py-8 text-center hover:border-accent">
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-medium text-slate-200">
              {file ? file.name : "Tap to choose your export ZIP"}
            </span>
            <span className="mt-1 text-xs text-night-400">
              Parsed once on the server, then stored — the ZIP itself is never kept.
            </span>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep(0)} disabled={busy}>
              Back
            </button>
            <button className="btn-primary flex-1" onClick={submit} disabled={busy || !file}>
              {busy ? "Importing…" : "Import library"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && summary && (
        <div className="card space-y-4 text-center">
          <p className="text-lg font-semibold text-white">Library imported 🎬</p>
          <dl className="grid grid-cols-2 gap-3 text-left text-sm">
            <div className="rounded-lg bg-night-800 p-3">
              <dt className="text-xs text-night-400">Diary entries</dt>
              <dd className="text-lg font-bold text-white">{summary.diaryEntries}</dd>
            </div>
            <div className="rounded-lg bg-night-800 p-3">
              <dt className="text-xs text-night-400">Watched</dt>
              <dd className="text-lg font-bold text-white">{summary.watched}</dd>
            </div>
            <div className="rounded-lg bg-night-800 p-3">
              <dt className="text-xs text-night-400">Ratings</dt>
              <dd className="text-lg font-bold text-white">{summary.ratings}</dd>
            </div>
            <div className="rounded-lg bg-night-800 p-3">
              <dt className="text-xs text-night-400">Watchlist</dt>
              <dd className="text-lg font-bold text-white">{summary.watchlist}</dd>
            </div>
          </dl>
          <p className="text-xs text-night-400">
            Files detected: {summary.filesFound.join(", ")} · {summary.totalUpserted} films stored
          </p>
          <button className="btn-primary w-full" onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </button>
        </div>
      )}
    </div>
  );
}
