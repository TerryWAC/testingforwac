"use client";

import { useState } from "react";

import { AppNav } from "@/components/AppNav";
import { Confetti } from "@/components/Confetti";
import { buzz } from "@/lib/haptics";

/** For when it's down to two — let fate decide with a 3D coin. */
export function CoinClient() {
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [rotation, setRotation] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [winner, setWinner] = useState<"A" | "B" | null>(null);

  function flip() {
    if (flipping || !optionA.trim() || !optionB.trim()) return;
    setWinner(null);
    setFlipping(true);
    const result: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
    // Whole spins plus a half turn when B wins so the blue face lands up.
    const spins = 5 + Math.floor(Math.random() * 3);
    setRotation((r) => r + spins * 360 + (result === "B" ? 180 : 0) - (r % 360));
    window.setTimeout(() => {
      setFlipping(false);
      setWinner(result);
      buzz([20, 40, 30]);
    }, 2100);
  }

  const winnerTitle = winner === "A" ? optionA : winner === "B" ? optionB : null;

  return (
    <div className="min-h-screen">
      <AppNav active="coin" />
      <main className="mx-auto max-w-md px-4 py-6 text-center">
        <h1 className="animate-fade-up title-grad text-2xl font-bold">Coin Flip</h1>
        <p className="animate-fade-up mt-1 text-sm text-night-400" style={{ animationDelay: "60ms" }}>
          Down to two films? Let fate call it.
        </p>

        <div className="animate-fade-up mt-6 space-y-3" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full bg-accent" />
            <input
              className="input"
              placeholder="First film"
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full bg-accent-blue" />
            <input
              className="input"
              placeholder="Second film"
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
            />
          </div>
        </div>

        {/* The coin */}
        <div className="mt-10 flex justify-center" style={{ perspective: "800px" }}>
          <div
            className="relative h-40 w-40"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateY(${rotation}deg)`,
              transition: flipping ? "transform 2s cubic-bezier(0.3, 0.7, 0.3, 1)" : "none",
            }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-accent/60 bg-gradient-to-br from-accent/30 to-night-800 p-4 text-sm font-black leading-tight text-white"
              style={{ backfaceVisibility: "hidden" }}
            >
              {optionA.trim() || "Film one"}
            </div>
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-accent-blue/60 bg-gradient-to-br from-accent-blue/30 to-night-800 p-4 text-sm font-black leading-tight text-white"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              {optionB.trim() || "Film two"}
            </div>
          </div>
        </div>

        <button
          className="btn-primary mt-10 w-full py-3.5 text-base"
          onClick={flip}
          disabled={flipping || !optionA.trim() || !optionB.trim()}
        >
          {flipping ? "Flipping…" : winner ? "Flip again" : "Flip the coin"}
        </button>

        {winner && winnerTitle && (
          <div className="animate-pop-in mt-6">
            <Confetti count={18} />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-night-400">
              The coin says
            </p>
            <p className={`mt-1 text-2xl font-black ${winner === "A" ? "text-accent" : "text-accent-blue"}`}>
              {winnerTitle}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
