"use client";

import { useEffect, useRef, useState } from "react";
import type { Scoreboard, ScoreEntry } from "@/lib/battle";

export { CONTESTANT_COLORS, cardGridClass, colorFor, contestantColor, contestantLabel, indexOf } from "@/lib/contestants";
import { colorFor, contestantColor } from "@/lib/contestants";

/** Rawia logo lock-up. `tone` picks the dark or light artwork per the brand guide. */
export function Brand({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/rawia-logo.svg"
      alt="Rawia"
      draggable={false}
      className={`h-10 w-auto select-none md:h-14 ${tone === "light" ? "invert" : ""} ${className}`}
    />
  );
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

/** Segmented share-of-vote bar: one slice per contestant, in display order, with a legend. */
export function BattleMeter({ board, size = "lg", tone = "light" }: { board: Scoreboard; size?: "sm" | "lg"; tone?: "light" | "dark" }) {
  const h = size === "lg" ? "h-6 md:h-9" : "h-3";
  const label = size === "lg" ? "text-lg md:text-2xl" : "text-sm";
  const track = tone === "dark" ? "bg-white/10 ring-white/10" : "bg-ink/10 ring-ink/10";
  const divider = tone === "dark" ? "bg-black/40" : "bg-apricot";
  return (
    <div className="w-full">
      <div className={`mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-display ${label}`}>
        {board.entries.map((e, i) => (
          <span key={e.code} style={{ color: contestantColor(i, tone) }}>
            {e.code} {e.pct}%
          </span>
        ))}
      </div>
      <div className={`relative flex ${h} w-full overflow-hidden rounded-full ring-1 ${track}`}>
        {board.entries.map((e, i) => (
          <div
            key={e.code}
            className="relative h-full transition-[width] duration-700 ease-out"
            style={{ width: `${e.pct}%`, background: contestantColor(i, tone) }}
          >
            {i > 0 && <span className={`absolute inset-y-0 left-0 w-0.5 ${divider}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeaderLine({ board, className }: { board: Scoreboard; className?: string }) {
  if (board.total === 0) return <p className={`font-display ${className ?? ""}`}>The battle begins — no votes yet</p>;
  if (!board.leader) {
    const top = Math.max(...board.entries.map((e) => e.votes));
    return <p className={`font-display ${className ?? ""}`}>Dead heat — tied at {top.toLocaleString("en-US")}</p>;
  }
  return (
    <p className={`font-display ${className ?? ""}`} style={{ color: colorFor(board, board.leader) }}>
      {board.leader} leads by {board.lead.toLocaleString("en-US")}
    </p>
  );
}

/** Final tallies side by side (“vs” between them for two contestants). */
export function ScoreRow({ board, sizeClass }: { board: Scoreboard; sizeClass?: string }) {
  const n = board.entries.length;
  const size = sizeClass ?? (n <= 2 ? "text-7xl md:text-9xl" : n <= 4 ? "text-5xl md:text-7xl" : "text-4xl md:text-6xl");
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-6 md:gap-10">
      {board.entries.map((e: ScoreEntry, i) => (
        <div key={e.code} className="flex items-center gap-6 md:gap-10">
          {i > 0 && n === 2 && <div className="eyebrow text-ink-soft">vs</div>}
          <div className="text-center">
            <div className="eyebrow" style={{ color: contestantColor(i) }}>
              {e.code}
            </div>
            <AnimatedNumber value={e.votes} className={`font-display ${size} leading-none text-ink`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Confetti({ index }: { index: number }) {
  const pieces = Array.from({ length: 48 }, (_, i) => i);
  const palette = ["bg-brick", "bg-olive", "bg-coffee"];
  const own = contestantColor(index);
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
            className={`absolute -top-6 block ${i % 2 ? "rounded-full" : "rounded-sm"} ${i % 3 === 0 ? "" : palette[i % 3]} animate-confetti`}
            style={
              {
                background: i % 3 === 0 ? own : undefined,
                left: `${left}%`,
                width: size,
                height: i % 2 ? size : size * 1.6,
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

/**
 * The fun bit: the Rawia jug tips over and "pours" the contestant colour into a cup,
 * which fills up while a wave laps at the surface. Then the counted check pops in.
 */
export function PourAnimation({ index }: { index: number }) {
  const hex = contestantColor(index);
  return (
    <div className="relative mx-auto h-44 w-56 md:h-52 md:w-64" aria-hidden>
      {/* Jug */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/rawia-mark.svg"
        alt=""
        draggable={false}
        className="absolute left-1/2 top-0 h-20 w-auto -translate-x-1/2 origin-bottom-left animate-pour md:h-24"
        style={{ filter: "invert(9%) sepia(20%) saturate(900%) hue-rotate(340deg) brightness(90%)" }}
      />
      {/* Drips */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute left-1/2 top-14 block h-6 w-3 rounded-full animate-drip md:top-16"
          style={{ background: hex, marginLeft: -6 + i * 10, animationDelay: `${0.5 + i * 0.18}s`, animationIterationCount: 3 }}
        />
      ))}
      {/* Cup */}
      <div className="absolute bottom-0 left-1/2 h-20 w-28 -translate-x-1/2 overflow-hidden rounded-b-[2.5rem] rounded-t-md border-4 border-ink bg-white/70 md:h-24 md:w-32">
        <div className="absolute inset-x-0 bottom-0 h-full animate-fill-up" style={{ animationDelay: "0.7s" }}>
          <svg className="absolute -top-3 left-0 h-6 w-[200%] animate-wave" viewBox="0 0 200 20" preserveAspectRatio="none">
            <path d="M0 10 Q 12.5 0 25 10 T 50 10 T 75 10 T 100 10 T 125 10 T 150 10 T 175 10 T 200 10 V 20 H 0 Z" fill={hex} />
          </svg>
          <div className="h-full w-full" style={{ background: hex }} />
        </div>
      </div>
      {/* Handle */}
      <div className="absolute bottom-5 left-1/2 ml-12 h-10 w-7 rounded-r-full border-4 border-l-0 border-ink md:ml-14 md:h-12 md:w-8" />
      {/* Check */}
      <div
        className="absolute right-0 bottom-16 flex h-12 w-12 items-center justify-center rounded-full bg-olive text-apricot shadow-lg animate-check md:bottom-20 md:h-14 md:w-14"
        style={{ animationDelay: "1.6s" }}
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </div>
    </div>
  );
}
