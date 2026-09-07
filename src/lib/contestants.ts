import type { Scoreboard } from "./battle";

/**
 * Card colours by contestant position, all from the Rawia brand palette:
 * Brick Red, Dark Coffee, Dusty Olive, then tan / deep brick / pitch black for 4–6.
 * `onDark` is a lighter stand-in for use on the admin's dark canvas.
 */
export const CONTESTANT_COLORS = [
  { hex: "#b63a2b", onDark: "#e0644f" },
  { hex: "#311f15", onDark: "#c9a27e" },
  { hex: "#6e7a3a", onDark: "#a4b35c" },
  { hex: "#8a6a4b", onDark: "#d8b48e" },
  { hex: "#8f2419", onDark: "#f08a78" },
  { hex: "#151400", onDark: "#a6a68a" },
] as const;

export function contestantColor(index: number, tone: "light" | "dark" = "light"): string {
  const c = CONTESTANT_COLORS[((index % CONTESTANT_COLORS.length) + CONTESTANT_COLORS.length) % CONTESTANT_COLORS.length];
  return tone === "dark" ? c.onDark : c.hex;
}

export function indexOf(board: Scoreboard, code: string | null): number {
  return board.entries.findIndex((e) => e.code === code);
}

export function colorFor(board: Scoreboard, code: string | null, tone: "light" | "dark" = "light"): string | undefined {
  const i = indexOf(board, code);
  return i < 0 ? undefined : contestantColor(i, tone);
}

export function contestantLabel(index: number): string {
  return `Contestant ${String(index + 1).padStart(2, "0")}`;
}

/** Grid column classes that keep 2–6 cards readable on a tablet in landscape. */
export function cardGridClass(n: number): string {
  if (n <= 2) return "grid-cols-1 md:grid-cols-2";
  if (n === 3) return "grid-cols-1 md:grid-cols-3";
  if (n === 4) return "grid-cols-2 lg:grid-cols-4";
  return "grid-cols-2 md:grid-cols-3";
}
