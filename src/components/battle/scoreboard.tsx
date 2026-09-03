"use client";

import { useEffect, useRef, useState } from "react";
import type { Scoreboard } from "@/lib/battle";

export const SIDE_CLASSES = {
  a: { text: "text-uos", bg: "bg-uos", deep: "bg-uos-deep", ring: "ring-uos", from: "from-uos", to: "to-uos-deep", shadow: "shadow-uos/40" },
  b: { text: "text-aus", bg: "bg-aus", deep: "bg-aus-deep", ring: "ring-aus", from: "from-aus", to: "to-aus-deep", shadow: "shadow-aus/40" },
} as const;

export type Side = keyof typeof SIDE_CLASSES;

export function sideOf(board: Scoreboard, code: string | null): Side | null {
  if (code === board.a.code) return "a";
  if (code === board.b.code) return "b";
  return null;
}

/** Animates from the previous value to the new one. */
export function AnimatedNumber({ value, className, durationMs = 700 }: { value: number; className?: string; durationMs?: number }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const startValue = from.current;
    if (startValue === value) return;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(startValue + (value - startValue) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return <span className={`tabular ${className ?? ""}`}>{display.toLocaleString("en-US")}</span>;
}

export function BattleMeter({ board, size = "lg" }: { board: Scoreboard; size?: "sm" | "lg" }) {
  const h = size === "lg" ? "h-8 md:h-12" : "h-4";
  const label = size === "lg" ? "text-xl md:text-3xl" : "text-sm";
  return (
    <div className="w-full">
      <div className={`flex items-center justify-between font-display ${label} mb-2`}>
        <span className="text-uos">
          {board.a.code} {board.a.pct}%
        </span>
        <span className="text-aus">
          {board.b.pct}% {board.b.code}
        </span>
      </div>
      <div className={`relative ${h} w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10`}>
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-uos-deep to-uos transition-[width] duration-700 ease-out"
          style={{ width: `${board.a.pct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-aus-deep to-aus transition-[width] duration-700 ease-out"
          style={{ width: `${board.b.pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-1 bg-white shadow-[0_0_16px_rgba(255,255,255,0.8)] transition-[left] duration-700 ease-out"
          style={{ left: `calc(${board.a.pct}% - 2px)` }}
        />
      </div>
    </div>
  );
}

export function LeaderLine({ board, className }: { board: Scoreboard; className?: string }) {
  if (board.total === 0) return <p className={`font-display ${className ?? ""}`}>THE BATTLE BEGINS — NO VOTES YET</p>;
  if (!board.leader) return <p className={`font-display ${className ?? ""}`}>🤝 DEAD HEAT — ALL TIED AT {board.a.votes}</p>;
  const side = sideOf(board, board.leader);
  return (
    <p className={`font-display ${side ? SIDE_CLASSES[side].text : ""} ${className ?? ""}`}>
      🔥 {board.leader} LEADS BY {board.lead.toLocaleString("en-US")}
    </p>
  );
}

export function ScorePair({ board, sizeClass = "text-7xl md:text-9xl" }: { board: Scoreboard; sizeClass?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-10 w-full">
      <div className="text-center">
        <div className="font-display text-3xl md:text-5xl text-uos">{board.a.code}</div>
        <AnimatedNumber value={board.a.votes} className={`font-display ${sizeClass} leading-none text-cream`} />
      </div>
      <div className="font-display text-4xl md:text-6xl text-gold italic">VS</div>
      <div className="text-center">
        <div className="font-display text-3xl md:text-5xl text-aus">{board.b.code}</div>
        <AnimatedNumber value={board.b.votes} className={`font-display ${sizeClass} leading-none text-cream`} />
      </div>
    </div>
  );
}

export function Confetti({ side }: { side: Side }) {
  const pieces = Array.from({ length: 60 }, (_, i) => i);
  const color = side === "a" ? "bg-uos" : "bg-aus";
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {pieces.map((i) => {
        const left = (i * 61) % 100;
        const dx = ((i * 37) % 200) - 100;
        const delay = (i % 10) * 0.08;
        const size = 8 + (i % 4) * 4;
        return (
          <span
            key={i}
            className={`absolute -top-6 block rounded-sm ${i % 3 === 0 ? "bg-gold" : color} animate-confetti`}
            style={
              {
                left: `${left}%`,
                width: size,
                height: size * 1.6,
                animationDelay: `${delay}s`,
                "--dx": `${dx}px`,
                "--rot": `${540 + (i % 5) * 120}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
