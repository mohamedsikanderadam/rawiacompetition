import Link from "next/link";
import { getAnalytics } from "@/lib/analytics";
import { countdownLabel, determineWinner, getCampaignStatus } from "@/lib/battle";
import { getCampaign, getScoreboard } from "@/lib/campaign";
import { formatYmdLong } from "@/lib/time";
import { Card, Stat, buttonClass, buttonDangerClass, buttonGhostClass, inputClass } from "@/components/admin/ui";
import { BattleMeter } from "@/components/battle/scoreboard";
import { resetDemoDataAction, startLiveCampaignAction } from "../actions";

export default async function AdminOverview() {
  const campaign = await getCampaign();
  const [board, analytics] = await Promise.all([getScoreboard(campaign), getAnalytics(campaign)]);
  const status = getCampaignStatus(campaign);
  const winner = determineWinner(board);

  const phaseLabel = { live: "Live — accepting votes", paused: "Paused", ended: "Ended", upcoming: "Not started" }[status.phase];
  const phaseTone = status.phase === "live" ? "text-emerald-300" : status.phase === "ended" ? "text-gold" : "text-amber-300";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">{campaign.name.toUpperCase()}</h1>
          <p className="text-cream/60">
            {formatYmdLong(campaign.startDate)} → {formatYmdLong(campaign.endDate)} · <span className={phaseTone}>{phaseLabel}</span> ·{" "}
            <span className="font-display">{countdownLabel(status)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/export/votes.csv" className={buttonGhostClass}>
            Export votes CSV
          </a>
          <a href="/api/admin/export/summary.csv" className={buttonGhostClass}>
            Export summary CSV
          </a>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={`${board.a.code} votes`} value={board.a.votes.toLocaleString()} hint={`${board.a.pct}% · ${board.a.name}`} tone="a" />
        <Stat label={`${board.b.code} votes`} value={board.b.votes.toLocaleString()} hint={`${board.b.pct}% · ${board.b.name}`} tone="b" />
        <Stat label="Total votes" value={board.total.toLocaleString()} hint="valid votes only" />
        <Stat
          label={status.phase === "ended" ? "Winner" : "Current leader"}
          value={board.leader ?? (board.total ? "TIE" : "—")}
          tone={board.leader === board.a.code ? "a" : board.leader === board.b.code ? "b" : "gold"}
        />
        <Stat label="Lead" value={board.lead.toLocaleString()} hint={"tie" in winner ? "dead heat" : `${winner.code} ahead`} tone="gold" />
      </div>

      <Card title="Battle meter">
        <BattleMeter board={board} size="sm" />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Today">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-cream/50">{board.a.code}</p>
              <p className="font-display text-3xl text-uos tabular">{analytics.today.a}</p>
            </div>
            <div>
              <p className="text-xs text-cream/50">{board.b.code}</p>
              <p className="font-display text-3xl text-aus tabular">{analytics.today.b}</p>
            </div>
            <div>
              <p className="text-xs text-cream/50">Total</p>
              <p className="font-display text-3xl tabular">{analytics.today.total}</p>
            </div>
            <div>
              <p className="text-xs text-cream/50">Leader today</p>
              <p className="font-display text-3xl">{analytics.today.leader ?? (analytics.today.total ? "TIE" : "—")}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-cream/70">
            Today&apos;s participation:{" "}
            {analytics.todayVsYesterdayPct === null ? (
              <span>no votes yesterday to compare</span>
            ) : (
              <span className={analytics.todayVsYesterdayPct >= 0 ? "text-emerald-300" : "text-red-300"}>
                {analytics.todayVsYesterdayPct >= 0 ? "+" : ""}
                {analytics.todayVsYesterdayPct}% vs yesterday ({analytics.yesterday.total})
              </span>
            )}
          </p>
        </Card>

        <Card title="Campaign pace">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-cream/50">Average votes / day</dt>
              <dd className="font-display text-2xl tabular">{analytics.averagePerDay}</dd>
            </div>
            <div>
              <dt className="text-cream/50">Days elapsed</dt>
              <dd className="font-display text-2xl tabular">{analytics.daysElapsed}</dd>
            </div>
            <div>
              <dt className="text-cream/50">Highest participation day</dt>
              <dd className="font-display text-2xl tabular">{analytics.peakDay ? `${analytics.peakDay.total} · ${analytics.peakDay.day}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-cream/50">Days left</dt>
              <dd className="font-display text-2xl tabular">{status.daysLeft}</dd>
            </div>
          </dl>
          <Link href="/admin/analytics" className="mt-4 inline-block text-sm text-gold hover:underline">
            Full analytics →
          </Link>
        </Card>
      </div>

      <Card title="Go live">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-cream/70">
              {campaign.mode === "demo"
                ? "The database currently contains demo votes for testing. Reload a fresh demo set, or clear everything and start the real campaign at 0 – 0."
                : "The campaign is live. Loading demo data will replace all real votes — only do this if you are testing."}
            </p>
            <form action={resetDemoDataAction} className="mt-4">
              <button type="submit" className={buttonGhostClass}>
                Reset demo data (UOS 327 / AUS 294)
              </button>
            </form>
          </div>
          <form action={startLiveCampaignAction} className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-cream/80">
              <strong>Start live campaign</strong> deletes every vote and resets the score to 0 – 0. The action is written to the audit log. Type <code>GO LIVE</code> to confirm.
            </p>
            <input name="confirm" placeholder="GO LIVE" className={inputClass} autoComplete="off" />
            <button type="submit" className={campaign.mode === "demo" ? buttonClass : buttonDangerClass}>
              Start live campaign
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
