"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string | null }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: next
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
          : `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setStatus("error");
      setError(
        authError.message.toLowerCase().includes("rate limit")
          ? "Too many requests — wait a minute before trying again."
          : authError.message
      );
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="card text-center">
        <p className="text-lg font-semibold text-white">Check your email</p>
        <p className="mt-2 text-sm text-night-400">
          We sent a login link to <span className="text-slate-200">{email}</span>. Open it on this
          device to sign in.
        </p>
        <button className="btn-secondary mt-4 w-full" onClick={() => setStatus("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="card space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-300">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send login link"}
      </button>
    </form>
  );
}
