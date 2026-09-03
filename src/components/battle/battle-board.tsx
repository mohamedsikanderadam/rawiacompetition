"use client";

import { useEffect, useState } from "react";
import type { PublicBattleState } from "@/lib/kiosk";
import { BattleMeter, LeaderLine, SIDE_CLASSES, ScorePair, sideOf } from "./scoreboard";

const REFRESH_MS = 3000;

/** Read-only public leaderboard. Polls /api/score; has no way to cast a vote. */
export function BattleBoard({ initial }: { initial: PublicBattleState }) {
  const [state, setState] = useState(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/score", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { state: PublicBattleState };
        if (active) {
          setState(json.state);
          setStale(false);
        }
      } catch {
        if (active) setStale(true);
      }
    };
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const { scoreboard: board, status, winner, campaign } = state;
  const urgencyClass = status.urgency === "normal" ? "text-cream/70" : status.urgency === "final-week" ? "text-gold" : "text-red-400 animate-pulse-slow";
  const winnerSide = winner && !("tie" in winner) ? sideOf(board, winner.code) : null;

  return (
    <main className="bg-arena flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10 text-cream md:gap-12">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-cream/50 md:text-base">Rawia Cafe presents</p>
        <h1 className="mt-2 font-display text-4xl md:text-7xl">{campaign.name.toUpperCase()}</h1>
        <p className={`mt-3 font-display text-2xl md:text-4xl ${urgencyClass}`}>{state.countdown}</p>
      </header>

      {status.phase === "ended" && winner && (
        <div className="text-center animate-pop">
          <h2 className="font-display text-3xl md:text-6xl">🏆 THE BATTLE IS OVER</h2>
          {"tie" in winner ? (
            <p className="mt-2 font-display text-2xl md:text-5xl text-gold">THE BATTLE ENDS IN A TIE 🤝</p>
          ) : (
            <p className={`mt-2 font-display text-2xl md:text-5xl ${winnerSide ? SIDE_CLASSES[winnerSide].text : ""}`}>
              {winner.name.toUpperCase()} WINS BY {winner.margin.toLocaleString("en-US")} 🔥
            </p>
          )}
        </div>
      )}

      <section className="w-full max-w-6xl">
        <ScorePair board={board} sizeClass="text-8xl md:text-[11rem]" />
      </section>

      <section className="w-full max-w-4xl space-y-4">
        {status.phase !== "ended" && <LeaderLine board={board} className="text-center text-2xl md:text-4xl" />}
        <BattleMeter board={board} />
        <p className="text-center text-sm uppercase tracking-widest text-cream/50 md:text-base">
          {board.total.toLocaleString("en-US")} purchases counted · updates live
          {stale && " · reconnecting…"}
        </p>
      </section>

      <footer className="text-center text-sm text-cream/50 md:text-lg">
        <p>Vote with every purchase at Rawia Cafe. Voting happens in-store only.</p>
        <p className="mt-1 text-xs text-cream/40">Independent Rawia Cafe campaign. Not affiliated with or endorsed by either university.</p>
      </footer>
    </main>
  );
}
