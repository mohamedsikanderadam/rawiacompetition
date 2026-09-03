"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scoreboard } from "@/lib/battle";
import type { KioskState } from "@/lib/kiosk";
import { BattleMeter, Confetti, LeaderLine, SIDE_CLASSES, ScorePair, sideOf, type Side } from "@/components/battle/scoreboard";
import { KioskSetup } from "./kiosk-setup";

type Screen =
  | { kind: "loading" }
  | { kind: "setup"; message?: string }
  | { kind: "vote" }
  | { kind: "attract" }
  | { kind: "submitting"; side: Side }
  | { kind: "confirmed"; side: Side; board: Scoreboard }
  | { kind: "failed"; title: string; message: string }
  | { kind: "closed" };

const TAGLINES: Record<Side, string[]> = {
  a: ["YOU JUST MOVED THE SCOREBOARD.", "SHARJAH STANDS UP.", "UOS IS NOT BACKING DOWN.", "ANOTHER ONE FOR THE UNIVERSITY OF SHARJAH."],
  b: ["AUS IS COMING FOR THE LEAD.", "THE AMERICANS HAVE ENTERED THE CHAT.", "AUS KEEPS THE PRESSURE ON.", "ANOTHER ONE FOR AUS."],
};

const STATE_REFRESH_MS = 15_000;
const FAILED_SCREEN_MS = 4_000;
const VOTE_TIMEOUT_MS = 6_000;

function newId(prefix: string) {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rnd}`.replace(/[^A-Za-z0-9_-]/g, "");
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export function KioskApp() {
  const [state, setState] = useState<KioskState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [online, setOnline] = useState(true);
  const lockRef = useRef(false);
  const sessionRef = useRef(newId("s"));
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const loadState = useCallback(async (): Promise<KioskState | null> => {
    try {
      const res = await fetchWithTimeout("/api/kiosk/state", { cache: "no-store" }, VOTE_TIMEOUT_MS);
      if (res.status === 401) {
        setScreen({ kind: "setup" });
        return null;
      }
      if (!res.ok) throw new Error(`state ${res.status}`);
      const json = (await res.json()) as { state: KioskState };
      setState(json.state);
      setOnline(true);
      return json.state;
    } catch {
      setOnline(false);
      return null;
    }
  }, []);

  /** Decide the resting screen from the campaign status. */
  const restingScreen = useCallback((s: KioskState | null): Screen => {
    if (!s) return { kind: "loading" };
    if (!s.device.active) return { kind: "setup", message: "This kiosk has been deactivated. Ask a manager for a new device token." };
    if (!s.status.acceptingVotes) return { kind: "closed" };
    return { kind: "vote" };
  }, []);

  // Initial load + periodic refresh so admin setting changes reach the kiosk without a reload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await loadState();
      if (!cancelled && s) setScreen(restingScreen(s));
    })();
    const interval = setInterval(async () => {
      const s = await loadState();
      const cur = screenRef.current;
      if (s && (cur.kind === "vote" || cur.kind === "closed" || cur.kind === "loading")) {
        const next = restingScreen(s);
        if (next.kind !== cur.kind) setScreen(next);
      }
    }, STATE_REFRESH_MS);
    const onWake = () => {
      void loadState().then((s) => {
        const cur = screenRef.current;
        if (s && (cur.kind === "vote" || cur.kind === "closed" || cur.kind === "loading")) setScreen(restingScreen(s));
      });
    };
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("offline", () => setOnline(false));
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [loadState, restingScreen]);

  // Keep the tablet screen awake where supported.
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible") sentinel = await wl.request("screen");
      } catch {
        /* not supported / denied */
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void sentinel?.release();
    };
  }, []);

  // Idle → attract screen.
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const s = state;
    if (!s?.settings.attractEnabled) return;
    idleTimer.current = setTimeout(() => {
      if (screenRef.current.kind === "vote") setScreen({ kind: "attract" });
    }, Math.max(5_000, s.settings.attractTimeoutMs));
  }, [state]);

  useEffect(() => {
    armIdle();
    const bump = () => {
      if (screenRef.current.kind === "vote") armIdle();
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [armIdle, screen.kind]);

  const resetToVote = useCallback(async () => {
    sessionRef.current = newId("s");
    lockRef.current = false;
    const s = (await loadState()) ?? state;
    setScreen(restingScreen(s));
  }, [loadState, restingScreen, state]);

  const vote = useCallback(
    async (side: Side) => {
      if (lockRef.current || !state) return;
      lockRef.current = true;
      setScreen({ kind: "submitting", side });
      const university = side === "a" ? state.campaign.a.code : state.campaign.b.code;
      const body = JSON.stringify({ university, sessionId: sessionRef.current, clientVoteId: newId("v") });

      const attempt = () =>
        fetchWithTimeout("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body, cache: "no-store" }, VOTE_TIMEOUT_MS);

      let res: Response | null = null;
      try {
        res = await attempt();
      } catch {
        // Network blip: retry once with the same idempotency key — never double counts.
        try {
          res = await attempt();
        } catch {
          res = null;
        }
      }

      if (!res) {
        setOnline(false);
        setScreen({ kind: "failed", title: "VOTE NOT RECORDED", message: "Connection lost. Please tap again once the kiosk is back online." });
        setTimeout(() => void resetToVote(), FAILED_SCREEN_MS);
        return;
      }

      type VoteResponse = { ok: true; scoreboard: Scoreboard } | { ok: false; code: string; message: string };
      let json: VoteResponse;
      try {
        json = (await res.json()) as VoteResponse;
      } catch {
        json = { ok: false, code: "bad_response", message: "Unexpected response from server." };
      }

      if (!json.ok) {
        if (json.code === "unauthorized_device") {
          lockRef.current = false;
          setScreen({ kind: "setup", message: "This kiosk is no longer authorised." });
          return;
        }
        if (json.code === "campaign_ended" || json.code === "campaign_inactive" || json.code === "campaign_not_started") {
          await resetToVote();
          return;
        }
        setScreen({
          kind: "failed",
          title: json.code === "too_fast" ? "DOUBLE TAP IGNORED" : "VOTE NOT RECORDED",
          message: json.code === "too_fast" ? "Only one vote per purchase was counted." : json.message,
        });
        setTimeout(() => void resetToVote(), json.code === "too_fast" ? 2000 : FAILED_SCREEN_MS);
        return;
      }

      setOnline(true);
      setState((prev) => (prev ? { ...prev, scoreboard: json.scoreboard } : prev));
      setScreen({ kind: "confirmed", side, board: json.scoreboard });
      setTimeout(() => void resetToVote(), Math.min(10_000, Math.max(1_000, state.settings.confirmationDurationMs)));
    },
    [state, resetToVote],
  );

  return (
    <main className="kiosk bg-arena fixed inset-0 flex flex-col overflow-hidden text-cream">
      {!online && (
        <div className="absolute inset-x-0 top-0 z-50 bg-red-600 px-4 py-2 text-center font-display text-sm md:text-base tracking-wide">
          OFFLINE — VOTES CANNOT BE RECORDED UNTIL THE CONNECTION RETURNS
        </div>
      )}

      {screen.kind === "loading" && (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-3xl animate-pulse-slow">LOADING THE BATTLE…</p>
        </div>
      )}

      {screen.kind === "setup" && <KioskSetup message={screen.message} onRegistered={() => void resetToVote()} />}

      {screen.kind === "closed" && state && <ClosedScreen state={state} />}

      {(screen.kind === "vote" || screen.kind === "attract" || screen.kind === "submitting") && state && (
        <VoteScreen state={state} pending={screen.kind === "submitting" ? screen.side : null} onVote={vote} />
      )}

      {screen.kind === "attract" && state && (
        <button
          type="button"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 md:gap-10 bg-background/95 backdrop-blur-sm px-6 text-center"
          onPointerDown={(e) => {
            e.preventDefault();
            setScreen({ kind: "vote" });
          }}
        >
          <div className="font-display text-5xl md:text-8xl leading-none animate-float">
            🔥 <span className="text-uos">{state.campaign.a.code}</span> <span className="text-gold">vs</span>{" "}
            <span className="text-aus">{state.campaign.b.code}</span> 🔥
          </div>
          <h2 className="font-display text-3xl md:text-6xl">WHICH UNIVERSITY RUNS RAWIA?</h2>
          <p className="font-display text-2xl md:text-4xl text-gold animate-pulse-slow">TAP TO REPRESENT YOUR UNIVERSITY</p>
          {state.settings.showScoresOnVote && (
            <div className="w-full max-w-3xl">
              <BattleMeter board={state.scoreboard} size="sm" />
            </div>
          )}
          <p className="absolute bottom-6 text-sm md:text-lg uppercase tracking-[0.3em] text-cream/60">{state.countdown}</p>
        </button>
      )}

      {screen.kind === "confirmed" && state && <ConfirmedScreen state={state} side={screen.side} board={screen.board} />}

      {screen.kind === "failed" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-background px-8 text-center animate-shake">
          <div className="text-7xl md:text-9xl">⚠️</div>
          <h2 className="font-display text-4xl md:text-7xl text-red-400">{screen.title}</h2>
          <p className="max-w-2xl text-xl md:text-3xl text-cream/80">{screen.message}</p>
        </div>
      )}
    </main>
  );
}

function VoteScreen({ state, pending, onVote }: { state: KioskState; pending: Side | null; onVote: (side: Side) => void }) {
  const { scoreboard: board, settings, campaign } = state;
  const showScores = settings.showScoresOnVote;
  const disabled = pending !== null;
  const urgencyClass = state.status.urgency === "normal" ? "text-cream/70" : state.status.urgency === "final-week" ? "text-gold" : "text-red-400 animate-pulse-slow";

  return (
    <div className="flex flex-1 flex-col px-4 py-4 md:px-10 md:py-8">
      <header className="flex items-center justify-between text-xs md:text-lg uppercase tracking-[0.3em] text-cream/60">
        <span>Rawia Cafe</span>
        <span className={`font-display ${urgencyClass}`}>{state.countdown}</span>
      </header>

      <div className="mt-3 text-center md:mt-6">
        <h1 className="font-display text-3xl md:text-6xl leading-tight">🔥 THE RAWIA UNIVERSITY BATTLE</h1>
        <h2 className="mt-2 font-display text-2xl md:text-5xl text-gold">WHO ARE YOU REPRESENTING?</h2>
      </div>

      <div className="mt-4 grid flex-1 grid-cols-1 gap-4 md:mt-8 md:grid-cols-[1fr_auto_1fr] md:gap-8 items-stretch">
        <VoteButton side="a" code={campaign.a.code} name={campaign.a.name} votes={showScores ? board.a.votes : null} pending={pending} disabled={disabled} onVote={onVote} />
        <div className="flex items-center justify-center font-display text-5xl md:text-8xl italic text-gold animate-glow">VS</div>
        <VoteButton side="b" code={campaign.b.code} name={campaign.b.name} votes={showScores ? board.b.votes : null} pending={pending} disabled={disabled} onVote={onVote} />
      </div>

      <footer className="mt-4 md:mt-8 space-y-3 md:space-y-4">
        {showScores && (
          <>
            <LeaderLine board={board} className="text-center text-2xl md:text-4xl" />
            <BattleMeter board={board} />
          </>
        )}
        <p className="text-center text-base md:text-2xl text-cream/70">Every purchase counts. Every vote moves the scoreboard.</p>
      </footer>
    </div>
  );
}

function VoteButton({
  side,
  code,
  name,
  votes,
  pending,
  disabled,
  onVote,
}: {
  side: Side;
  code: string;
  name: string;
  votes: number | null;
  pending: Side | null;
  disabled: boolean;
  onVote: (side: Side) => void;
}) {
  const c = SIDE_CLASSES[side];
  const isPending = pending === side;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Vote ${code} — ${name}`}
      onClick={() => onVote(side)}
      className={`relative flex min-h-[28vh] md:min-h-[40vh] flex-col items-center justify-center rounded-3xl bg-gradient-to-br ${c.from} ${c.to} p-6 text-center shadow-2xl ${c.shadow} ring-4 ring-white/10 transition-transform duration-150 active:scale-[0.97] disabled:opacity-70 ${isPending ? "animate-pulse-slow" : ""}`}
    >
      <span className="font-display text-7xl md:text-[10rem] leading-none text-white drop-shadow-lg">{code}</span>
      <span className="mt-3 font-display text-xl md:text-3xl uppercase text-white/90">{name}</span>
      {votes !== null && <span className="mt-4 font-display text-4xl md:text-6xl tabular text-white">{votes.toLocaleString("en-US")}</span>}
      {isPending && <span className="absolute bottom-4 text-sm md:text-lg uppercase tracking-widest text-white/80">Recording…</span>}
    </button>
  );
}

function ConfirmedScreen({ state, side, board }: { state: KioskState; side: Side; board: Scoreboard }) {
  const c = SIDE_CLASSES[side];
  const code = side === "a" ? board.a.code : board.b.code;
  const tagline = TAGLINES[side][board.total % TAGLINES[side].length];
  const showScore = state.settings.showConfirmationScore;
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 md:gap-10 bg-background px-6 text-center">
      <Confetti side={side} />
      <div className={`font-display text-8xl md:text-[12rem] leading-none ${c.text} animate-pop`}>+1 {code} 🔥</div>
      {showScore ? (
        <>
          <h2 className="font-display text-2xl md:text-5xl animate-rise">{tagline}</h2>
          <div className="w-full max-w-5xl animate-rise" style={{ animationDelay: "0.2s" }}>
            <ScorePair board={board} />
          </div>
          <div className="w-full max-w-4xl animate-rise" style={{ animationDelay: "0.4s" }}>
            <LeaderLine board={board} className="mb-3 text-center text-2xl md:text-4xl" />
            <BattleMeter board={board} />
          </div>
        </>
      ) : (
        <h2 className="font-display text-4xl md:text-7xl animate-rise">YOUR VOTE IS IN 🔥</h2>
      )}
    </div>
  );
}

function ClosedScreen({ state }: { state: KioskState }) {
  const { status, scoreboard: board, winner, campaign } = state;
  if (status.phase === "ended" && winner) {
    const winnerSide = "tie" in winner ? null : sideOf(board, winner.code);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 md:gap-10 px-6 text-center">
        <h1 className="font-display text-4xl md:text-7xl">🏆 THE BATTLE IS OVER</h1>
        {"tie" in winner ? (
          <h2 className="font-display text-3xl md:text-6xl text-gold">THE BATTLE ENDS IN A TIE 🤝</h2>
        ) : (
          <h2 className={`font-display text-3xl md:text-6xl ${winnerSide ? SIDE_CLASSES[winnerSide].text : ""}`}>{winner.name.toUpperCase()} WINS!</h2>
        )}
        <div className="w-full max-w-5xl">
          <ScorePair board={board} />
        </div>
        {!("tie" in winner) && (
          <p className="font-display text-2xl md:text-4xl">
            {winner.code} WINS BY {winner.margin.toLocaleString("en-US")} {winner.margin === 1 ? "PURCHASE" : "PURCHASES"} 🔥
          </p>
        )}
        <div className="w-full max-w-4xl">
          <BattleMeter board={board} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-4xl md:text-7xl">🔥 {campaign.name.toUpperCase()}</h1>
      <h2 className="font-display text-2xl md:text-5xl text-gold">{status.phase === "upcoming" ? "COMING SOON" : "VOTING IS PAUSED"}</h2>
      <p className="text-lg md:text-2xl text-cream/70">
        {status.phase === "upcoming" ? "The battle has not started yet." : "Please ask a member of the Rawia team."}
      </p>
    </div>
  );
}
