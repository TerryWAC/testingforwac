import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";

const MODES = [
  {
    href: "/dashboard",
    name: "Recommend",
    desc: "Set the mood and get eight tailored picks — the classic way.",
    tag: "Start here",
  },
  {
    href: "/faceoff",
    name: "Final Cut",
    desc: "Eight films, head-to-head knockouts, one champion. Great for two.",
    tag: "Tournament",
  },
  {
    href: "/veto",
    name: "Veto Draft",
    desc: "Take turns striking films off the board until one survives.",
    tag: "For couples",
  },
  {
    href: "/wheel",
    name: "Spin the Wheel",
    desc: "A poster reel spins and fate picks. Respin as much as you like.",
    tag: "Fast",
  },
  {
    href: "/slots",
    name: "Lucky Slots",
    desc: "Mood, era and runtime lock in like a slot machine, picks deal out.",
    tag: "Chaotic",
  },
  {
    href: "/match",
    name: "Movie Match",
    desc: "Swipe through your library — save the yeses for later.",
    tag: "Solo browse",
  },
  {
    href: "/double",
    name: "Double Feature",
    desc: "Two films that pair well — same era, contrast, or a marathon.",
    tag: "Long night",
  },
  {
    href: "/coin",
    name: "Coin Flip",
    desc: "Down to two? A 3D coin makes the final call.",
    tag: "Tiebreaker",
  },
];

export default async function PlayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div className="min-h-screen">
      <AppNav active="play" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="animate-fade-up text-2xl font-bold text-white">Ways to Pick</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Eight ways to end the &ldquo;what should we watch&rdquo; argument. Pick your weapon.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {MODES.map((m, i) => (
            <Link
              key={m.href}
              href={m.href}
              className="card animate-fade-up group transition-all hover:-translate-y-0.5 hover:border-accent"
              style={{ animationDelay: `${100 + i * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-white group-hover:text-accent">{m.name}</p>
                <span className="shrink-0 rounded-full bg-night-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-night-400">
                  {m.tag}
                </span>
              </div>
              <p className="mt-1 text-sm leading-snug text-slate-300">{m.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
