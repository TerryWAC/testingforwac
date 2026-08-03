"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Turn Supabase's auth errors into something a person can act on.
 *
 * The rate-limit cases matter most: the built-in mailer allows only a couple
 * of messages per hour, and "wait a minute" is actively misleading advice
 * when the real answer is an hour or a specific number of seconds.
 */
function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();

  // "For security purposes, you can only request this after 47 seconds."
  const seconds = lower.match(/after (\d+) seconds?/)?.[1];
  if (seconds) {
    return `Just sent one — you can request another in ${seconds} second${seconds === "1" ? "" : "s"}. Check your inbox and spam folder in the meantime.`;
  }

  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many sign-in emails have been sent recently. Wait an hour and try again — or use the 6-digit code from an email you've already received.";
  }
  if (lower.includes("invalid") && lower.includes("token")) {
    return "That code isn't right, or it's expired. Codes last one hour and work once.";
  }
  if (lower.includes("expired")) {
    return "That code has expired. Request a new link below.";
  }
  return message;
}

export function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  // Kept separate from `status`: verifying can happen from either the
  // post-send screen or the code-only screen, and folding it into the union
  // would bounce the code-only user onto the "check your email" view.
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lets someone in with a code even when the mailer is refusing new sends.
  const [codeMode, setCodeMode] = useState(false);

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
      setStatus("idle");
      setError(friendlyAuthError(authError.message));
    } else {
      setStatus("sent");
    }
  }

  /**
   * Verify the 6-digit code from the email. The templates have always offered
   * it as a fallback for mail apps that mangle links; this is where it's
   * redeemed. It's also the only way in once the email rate limit is hit.
   */
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    setVerifying(false);
    if (authError) {
      setError(friendlyAuthError(authError.message));
      return;
    }
    router.push(next ?? "/dashboard");
    router.refresh();
  }

  const codeInput = (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">6-digit code</span>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        className="input text-center text-2xl font-black tracking-[0.5em]"
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </label>
  );

  if (status === "sent") {
    return (
      <div className="card">
        <p className="text-center text-lg font-semibold text-white">Check your email</p>
        <p className="mt-2 text-center text-sm text-night-400">
          We sent a link to <span className="text-slate-200">{email}</span>. Tap it on this device,
          or enter the code from the email below.
        </p>

        <form onSubmit={verifyCode} className="mt-5 space-y-3">
          {codeInput}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={code.length !== 6 || verifying}
          >
            {verifying ? "Signing in…" : "Sign in with code"}
          </button>
        </form>

        <button
          className="btn-secondary mt-3 w-full"
          onClick={() => {
            setStatus("idle");
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (codeMode) {
    return (
      <form onSubmit={verifyCode} className="card space-y-4">
        <p className="text-sm text-night-400">
          Enter the address you signed in with and the 6-digit code from any sign-in email you
          still have. Codes last an hour.
        </p>
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
        {codeInput}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={code.length !== 6 || !email || verifying}
        >
          {verifying ? "Signing in…" : "Sign in with code"}
        </button>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => {
            setCodeMode(false);
            setError(null);
          }}
        >
          Email me a link instead
        </button>
      </form>
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
      <button
        type="button"
        className="w-full text-center text-xs font-semibold text-night-400 hover:text-accent"
        onClick={() => {
          setCodeMode(true);
          setError(null);
        }}
      >
        Already have a code from an email?
      </button>
    </form>
  );
}
