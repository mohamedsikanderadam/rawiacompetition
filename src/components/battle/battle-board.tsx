"use client";

import { useEffect, useState } from "react";
import type { PublicBattleState } from "@/lib/kiosk";
import { BattleMeter, Brand, LeaderLine, cardGridClass, colorFor, contestantColor, contestantLabel } from "./scoreboard";

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
  const urgencyClass = status.urgency === "normal" ? "text-ink-soft" : status.urgency === "final-week" ? "text-olive" : "text-brick animate-pulse-slow";
  const n = board.entries.length;
  const compact = n > 2;
  const dense = n > 4;

  return (
    <main className="bg-arena flex min-h-screen flex-col px-5 py-5 text-ink md:px-12 md:py-8">
      <header className="flex items-start justify-between">
        <Brand />
        <div className="eyebrow text-right leading-relaxed text-ink-soft">
          <div>Live leaderboard</div>
          <div className={urgencyClass}>{state.countdown}</div>
          <div className="opacity-70">{stale ? "Reconnecting…" : "Updates every 3s"}</div>
        </div>
      </header>

      <section className="mt-8 md:mt-12">
        <p className="eyebrow text-brick">Rawia Cafe presents</p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-8xl">
          {campaign.headline}
          <br />
          <span className="text-brick">{campaign.headlineAccent}</span>
        </h1>
      </section>

      {status.phase === "ended" && winner && (
        <section className="mt-8 rounded-[2rem] bg-ink p-6 text-apricot animate-pop md:p-10">
          <p className="eyebrow opacity-70">The battle is over</p>
          {"tie" in winner ? (
            <h2 className="mt-2 font-display text-4xl md:text-7xl">It ends in a tie.</h2>
          ) : (
            <h2 className="mt-2 font-display text-4xl md:text-7xl" style={{ color: colorFor(board, winner.code, "dark") }}>
              {winner.name} wins by {winner.margin.toLocaleString("en-US")}.
            </h2>
          )}
        </section>
      )}

      <section className={`mt-8 grid flex-1 gap-3 md:mt-12 md:gap-5 ${cardGridClass(n)}`}>
        {board.entries.map((s, i) => {
          const leading = board.leader === s.code;
          return (
            <div
              key={s.code}
              style={{ background: contestantColor(i) }}
              className={`relative flex flex-col justify-between rounded-[2rem] text-apricot ${dense ? "min-h-[18vh] p-4 md:p-6" : compact ? "min-h-[22vh] p-5 md:p-7" : "min-h-[26vh] p-6 md:p-9"}`}
            >
              <div className="flex items-start justify-between">
                <span className="eyebrow opacity-80">{contestantLabel(i)}</span>
                {leading && <span className="eyebrow rounded-full bg-apricot px-3 py-1 text-ink">Leading</span>}
              </div>
              <div>
                <div className={`font-display leading-none tabular ${dense ? "text-4xl md:text-6xl" : compact ? "text-5xl md:text-8xl" : "text-7xl md:text-[9rem]"}`}>
                  {s.votes.toLocaleString("en-US")}
                </div>
                <div className={`mt-3 font-display ${dense ? "text-xl md:text-3xl" : "text-3xl md:text-5xl"}`}>{s.code}</div>
                <div className={`mt-1 opacity-90 ${dense ? "text-sm md:text-lg" : "text-lg md:text-2xl"}`}>{s.name}</div>
              </div>
              <div className="eyebrow mt-4 opacity-80">{s.pct}% of all votes</div>
            </div>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 md:mt-8 md:grid-cols-[1fr_auto] md:items-end">
        <BattleMeter board={board} />
        <div className="text-right">
          {status.phase !== "ended" && <LeaderLine board={board} className="text-2xl md:text-4xl" />}
          <p className="eyebrow mt-1 text-ink-soft">{board.total.toLocaleString("en-US")} votes counted</p>
        </div>
      </section>

      <footer className="eyebrow mt-8 flex flex-col gap-1 text-ink-soft md:flex-row md:justify-between">
        <p>Vote with every purchase at Rawia Cafe. In-store only.</p>
        <p className="opacity-70">Independent Rawia Cafe campaign. Not affiliated with or endorsed by any contestant.</p>
      </footer>
    </main>
  );
}
