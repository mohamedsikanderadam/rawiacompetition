"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scoreboard } from "@/lib/battle";
import type { KioskState } from "@/lib/kiosk";
import { BattleMeter, Brand, Confetti, LeaderLine, PourAnimation, ScoreRow, cardGridClass, colorFor, contestantColor, contestantLabel, indexOf } from "@/components/battle/scoreboard";
import { KioskSetup } from "./kiosk-setup";

type Screen =
  | { kind: "loading" }
  | { kind: "setup"; message?: string }
  | { kind: "vote" }
  | { kind: "attract" }
  | { kind: "submitting"; code: string }
  | { kind: "confirmed"; code: string; board: Scoreboard }
  | { kind: "failed"; title: string; message: string }
  | { kind: "closed" };


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
    async (university: string) => {
      if (lockRef.current || !state) return;
      lockRef.current = true;
      setScreen({ kind: "submitting", code: university });
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
        setScreen({ kind: "failed", title: "Vote not recorded", message: "Connection lost. Please tap again once the kiosk is back online." });
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
          title: json.code === "too_fast" ? "Double tap ignored" : "Vote not recorded",
          message: json.code === "too_fast" ? "Only one vote per purchase was counted." : json.message,
        });
        setTimeout(() => void resetToVote(), json.code === "too_fast" ? 2000 : FAILED_SCREEN_MS);
        return;
      }

      setOnline(true);
      setState((prev) => (prev ? { ...prev, scoreboard: json.scoreboard } : prev));
      setScreen({ kind: "confirmed", code: university, board: json.scoreboard });
      setTimeout(() => void resetToVote(), Math.min(10_000, Math.max(1_000, state.settings.confirmationDurationMs)));
    },
    [state, resetToVote],
  );


  return (
    <main className="kiosk bg-arena fixed inset-0 flex flex-col overflow-hidden text-ink">
      {!online && (
        <div className="absolute inset-x-0 top-0 z-50 bg-brick px-4 py-2 text-center font-display text-sm tracking-wide text-apricot md:text-base">
          Offline — votes cannot be recorded until the connection returns
        </div>
      )}

      {screen.kind === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <Brand className="animate-wiggle" />
          <p className="eyebrow text-ink-soft animate-pulse-slow">Brewing the battle…</p>
        </div>
      )}

      {screen.kind === "setup" && <KioskSetup message={screen.message} onRegistered={() => void resetToVote()} />}

      {screen.kind === "closed" && state && <ClosedScreen state={state} />}

      {(screen.kind === "vote" || screen.kind === "attract" || screen.kind === "submitting") && state && (
        <VoteScreen state={state} pending={screen.kind === "submitting" ? screen.code : null} onVote={vote} />
      )}

      {screen.kind === "attract" && state && (
        <button
          type="button"
          className="bg-arena absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 px-6 text-center md:gap-8"
          onPointerDown={(e) => {
            e.preventDefault();
            setScreen({ kind: "vote" });
          }}
        >
          <Brand className="animate-wiggle !h-16 md:!h-24" />
          <p className="eyebrow text-brick">Rawia Cafe presents</p>
          <div className={`flex flex-wrap items-center justify-center gap-x-4 font-display leading-none ${state.campaign.contestants.length > 3 ? "text-4xl md:text-7xl" : "text-6xl md:text-9xl"}`}>
            {state.campaign.contestants.map((c, i) => (
              <span key={c.code} className="inline-flex items-center gap-x-4">
                {i > 0 && <span className="text-ink-soft">vs</span>}
                <span style={{ color: contestantColor(i) }}>{c.code}</span>
              </span>
            ))}
          </div>
          <h2 className="font-display text-3xl md:text-5xl">
            {state.campaign.headline} <span className="text-brick">{state.campaign.headlineAccent}</span>
          </h2>
          <p className="rounded-full bg-ink px-6 py-3 font-display text-lg text-apricot animate-float md:text-2xl">Tap anywhere to cast your vote</p>
          {state.settings.showScoresOnVote && (
            <div className="w-full max-w-3xl">
              <BattleMeter board={state.scoreboard} size="sm" />
            </div>
          )}
          <p className="eyebrow absolute bottom-6 text-ink-soft">{state.countdown}</p>
        </button>
      )}

      {screen.kind === "confirmed" && state && <ConfirmedScreen state={state} code={screen.code} board={screen.board} />}

      {screen.kind === "failed" && (
        <div className="bg-arena absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 px-8 text-center animate-shake">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brick text-apricot md:h-32 md:w-32">
            <svg viewBox="0 0 24 24" className="h-14 w-14 md:h-20 md:w-20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 6v8M12 18h.01" />
            </svg>
          </div>
          <p className="eyebrow text-brick">Not counted</p>
          <h2 className="font-display text-4xl text-ink md:text-7xl">{screen.title}</h2>
          <p className="max-w-2xl text-xl text-ink-soft md:text-3xl">{screen.message}</p>
        </div>
      )}
    </main>
  );
}

function KioskHeader({ state }: { state: KioskState }) {
  const urgency = state.status.urgency === "normal" ? "text-ink-soft" : state.status.urgency === "final-week" ? "text-olive" : "text-brick animate-pulse-slow";
  return (
    <header className="flex items-start justify-between">
      <Brand />
      <div className="eyebrow text-right leading-relaxed text-ink-soft">
        <div>Tap once. Make it count.</div>
        <div className={urgency}>{state.countdown}</div>
        <div className="opacity-70">Station {state.device.identifier.toUpperCase()}</div>
      </div>
    </header>
  );
}

function VoteScreen({ state, pending, onVote }: { state: KioskState; pending: string | null; onVote: (code: string) => void }) {
  const { scoreboard: board, settings, campaign } = state;
  const showScores = settings.showScoresOnVote;
  const disabled = pending !== null;
  const n = campaign.contestants.length;

  return (
    <div className="flex flex-1 flex-col px-5 py-5 md:px-12 md:py-8">
      <KioskHeader state={state} />

      <div className="mt-6 md:mt-10">
        <p className="eyebrow text-brick">Rawia Cafe presents</p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] md:text-8xl">
          {campaign.headline}
          <br />
          <span className="text-brick">{campaign.headlineAccent}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-soft md:text-2xl">{campaign.subline}</p>
      </div>

      <div className={`mt-6 grid flex-1 gap-3 md:mt-10 md:gap-5 ${cardGridClass(n)}`}>
        {campaign.contestants.map((c, i) => (
          <VoteButton
            key={c.code}
            index={i}
            count={n}
            code={c.code}
            name={c.name}
            votes={showScores ? (board.entries.find((e) => e.code === c.code)?.votes ?? 0) : null}
            pending={pending}
            disabled={disabled}
            onVote={onVote}
          />
        ))}
      </div>

      <footer className="mt-5 flex flex-col gap-3 md:mt-8 md:flex-row md:items-end md:justify-between">
        {showScores ? (
          <div className="w-full md:max-w-xl">
            <BattleMeter board={board} size="sm" />
          </div>
        ) : (
          <span />
        )}
        <div className="eyebrow text-ink-soft">
          {showScores ? <LeaderLine board={board} className="font-mono font-medium normal-case tracking-normal" /> : "Every purchase counts."}
        </div>
      </footer>
    </div>
  );
}

function VoteButton({
  index,
  count,
  code,
  name,
  votes,
  pending,
  disabled,
  onVote,
}: {
  index: number;
  count: number;
  code: string;
  name: string;
  votes: number | null;
  pending: string | null;
  disabled: boolean;
  onVote: (code: string) => void;
}) {
  const isPending = pending === code;
  const compact = count > 2;
  const dense = count > 4;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Vote ${code} — ${name}`}
      onClick={() => onVote(code)}
      style={{ background: contestantColor(index) }}
      className={`relative flex flex-col justify-between rounded-[2rem] text-left text-apricot shadow-2xl shadow-ink/20 transition-transform duration-150 active:scale-[0.97] disabled:opacity-80 ${
        dense ? "min-h-[18vh] p-4 md:min-h-[22vh] md:p-6" : compact ? "min-h-[20vh] p-5 md:min-h-[30vh] md:p-7" : "min-h-[26vh] p-6 md:min-h-[38vh] md:p-9"
      } ${isPending ? "animate-pulse-slow" : ""}`}
    >
      <div className="flex items-start justify-between">
        <span className="eyebrow opacity-80">{contestantLabel(index)}</span>
        {votes !== null && <span className={`font-display tabular ${dense ? "text-xl md:text-2xl" : "text-2xl md:text-4xl"}`}>{votes.toLocaleString("en-US")}</span>}
      </div>
      <div>
        <span className={`block font-display leading-none ${dense ? "text-4xl md:text-6xl" : compact ? "text-5xl md:text-8xl" : "text-7xl md:text-[9rem]"}`}>{code}</span>
        <span className={`mt-3 block font-medium opacity-90 ${dense ? "text-sm md:text-lg" : "text-lg md:text-2xl"}`}>{name}</span>
      </div>
      <span className="eyebrow mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-apricot/15 px-4 py-2">
        {isPending ? "Recording…" : `Tap to vote ${code}`}
        {!isPending && <span aria-hidden>→</span>}
      </span>
    </button>
  );
}

function ConfirmedScreen({ state, code, board }: { state: KioskState; code: string; board: Scoreboard }) {
  const index = Math.max(0, indexOf(board, code));
  const showScore = state.settings.showConfirmationScore;
  return (
    <div className="bg-arena absolute inset-0 z-40 flex flex-col overflow-hidden px-5 py-5 md:px-12 md:py-8">
      <Confetti index={index} />
      <KioskHeader state={state} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center md:gap-4">
        <PourAnimation index={index} />
        <p className="eyebrow text-olive animate-rise">Counted</p>
        <h2 className="font-display text-4xl leading-[0.95] md:text-7xl animate-rise" style={{ animationDelay: "0.1s" }}>
          Your voice is in.
        </h2>
        <p className="max-w-xl text-base text-ink-soft md:text-xl animate-rise" style={{ animationDelay: "0.2s" }}>
          One tap for{" "}
          <span className="font-bold" style={{ color: contestantColor(index) }}>
            {code}
          </span>
          . Thank you for backing your side at Rawia.
        </p>
        {showScore && (
          <div className="mt-1 w-full max-w-3xl animate-rise" style={{ animationDelay: "0.35s" }}>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-ink/10 bg-white/50 p-4 text-left md:p-5">
              <div>
                <p className="eyebrow text-ink-soft">Current leader</p>
                <p className="mt-1 font-display text-2xl text-ink md:text-4xl" style={{ color: colorFor(board, board.leader) }}>
                  {board.leader ?? (board.total ? "Tied" : "—")}
                </p>
              </div>
              <div className="text-right">
                <p className="eyebrow text-ink-soft">Tally</p>
                <p className={`mt-1 font-display tabular ${board.entries.length > 3 ? "text-lg md:text-2xl" : "text-2xl md:text-4xl"}`}>
                  {board.entries.map((e, i) => (
                    <span key={e.code}>
                      {i > 0 && <span className="text-ink-soft"> · </span>}
                      <span style={{ color: contestantColor(i) }}>{e.votes.toLocaleString("en-US")}</span>
                    </span>
                  ))}
                </p>
              </div>
              <div className="col-span-2">
                <BattleMeter board={board} size="sm" />
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="eyebrow text-center text-ink-soft">Ready for the next voice</p>
    </div>
  );
}

function ClosedScreen({ state }: { state: KioskState }) {
  const { status, scoreboard: board, winner, campaign } = state;
  return (
    <div className="flex flex-1 flex-col px-5 py-5 md:px-12 md:py-8">
      <KioskHeader state={state} />
      {status.phase === "ended" && winner ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center md:gap-8">
          <p className="eyebrow text-brick animate-rise">The battle is over</p>
          {"tie" in winner ? (
            <h1 className="font-display text-5xl md:text-8xl animate-pop">It ends in a tie.</h1>
          ) : (
            <h1 className="font-display text-5xl md:text-8xl animate-pop" style={{ color: colorFor(board, winner.code) }}>
              {winner.name} wins.
            </h1>
          )}
          <div className="w-full max-w-5xl">
            <ScoreRow board={board} />
          </div>
          {!("tie" in winner) && (
            <p className="text-xl text-ink-soft md:text-3xl">
              {winner.code} wins by {winner.margin.toLocaleString("en-US")} {winner.margin === 1 ? "vote" : "votes"}.
            </p>
          )}
          <div className="w-full max-w-3xl">
            <BattleMeter board={board} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <p className="eyebrow text-brick">Rawia Cafe presents</p>
          <h1 className="font-display text-5xl md:text-8xl">{campaign.name}</h1>
          <h2 className="font-display text-2xl text-ink-soft md:text-4xl">{status.phase === "upcoming" ? "Coming soon." : "Voting is paused."}</h2>
          <p className="text-lg text-ink-soft md:text-2xl">{status.phase === "upcoming" ? "The battle has not started yet." : "Please ask a member of the Rawia team."}</p>
        </div>
      )}
    </div>
  );
}
