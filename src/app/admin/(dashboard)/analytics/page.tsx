import { getAnalytics, leaderOf } from "@/lib/analytics";
import { getCampaignStatus, type Totals } from "@/lib/battle";
import { getCampaign, getScoreboard } from "@/lib/campaign";
import { Card, Stat, Table } from "@/components/admin/ui";
import { contestantColor } from "@/components/battle/scoreboard";

export default async function AnalyticsPage() {
  const campaign = await getCampaign();
  const [board, a] = await Promise.all([getScoreboard(campaign), getAnalytics(campaign)]);
  const status = getCampaignStatus(campaign);
  const codes = a.contestants.map((c) => c.code);
  const color = (i: number) => contestantColor(i, "dark");
  const maxDay = Math.max(1, ...a.byDay.map((d) => d.total));
  const maxHour = Math.max(1, ...a.byHour.map((h) => h.total));
  const maxCum = Math.max(1, ...a.byDay.flatMap((d) => codes.map((c) => d.cumulative[c] ?? 0)));
  const breakdown = (counts: Totals) => codes.map((c) => `${c} ${counts[c] ?? 0}`).join(" · ");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">CAMPAIGN ANALYTICS</h1>
        <p className="text-cream/60">All figures count valid votes only, in Rawia local time.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total votes" value={board.total.toLocaleString()} />
        {board.entries.map((e, i) => (
          <Stat key={e.code} label={`${e.code} votes`} value={e.votes.toLocaleString()} hint={`${e.pct}%`} color={color(i)} />
        ))}
        <Stat label="Current leader" value={board.leader ?? (board.total ? "TIE" : "—")} hint={`lead over 2nd: ${board.lead}`} tone="gold" />
        <Stat label="Votes today" value={a.today.total} hint={breakdown(a.today.counts)} />
        <Stat label="Votes yesterday" value={a.yesterday.total} hint={breakdown(a.yesterday.counts)} />
        <Stat label="Average votes / day" value={a.averagePerDay} hint={`${a.daysElapsed} days elapsed · ${status.daysLeft} left`} />
        <Stat label="Highest participation day" value={a.peakDay?.total ?? "—"} hint={a.peakDay?.day} />
      </div>

      <Card title="Votes by day">
        <div className="flex h-56 items-end gap-1">
          {a.byDay.map((d) => (
            <div key={d.day} className="relative flex h-full flex-1 items-end" title={`${d.day}: ${breakdown(d.counts)}`}>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(d.total / maxDay) * 100}%` }}>
                {codes.map((c, i) => (
                  <div key={c} style={{ flex: d.counts[c] ?? 0, background: color(i) }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-cream/50">
          <span>{a.byDay[0]?.day}</span>
          <span>{a.byDay[a.byDay.length - 1]?.day}</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Votes by hour of day">
          <div className="flex h-48 items-end gap-1">
            {a.byHour.map((h) => (
              <div key={h.hour} className="flex h-full flex-1 items-end" title={`${String(h.hour).padStart(2, "0")}:00 — ${breakdown(h.counts)}`}>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(h.total / maxHour) * 100}%` }}>
                  {codes.map((c, i) => (
                    <div key={c} style={{ flex: h.counts[c] ?? 0, background: color(i) }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-cream/50">
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
        </Card>

        <Card title="Cumulative votes">
          <svg viewBox="0 0 400 180" className="h-48 w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative votes over the campaign">
            {codes.map((c, i) => {
              const pts = a.byDay.map((d, j) => {
                const x = a.byDay.length === 1 ? 0 : (j / (a.byDay.length - 1)) * 400;
                const y = 176 - ((d.cumulative[c] ?? 0) / maxCum) * 170;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              });
              return <polyline key={c} points={pts.join(" ")} fill="none" stroke={color(i)} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
            })}
          </svg>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            {board.entries.map((e, i) => (
              <span key={e.code} style={{ color: color(i) }}>
                ● {e.code} {e.votes}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Votes by device">
        <Table head={["Device", "Identifier", ...codes, "Total", "Status"]}>
          {a.byDevice.map((d) => (
            <tr key={d.deviceId}>
              <td className="px-4 py-3">{d.deviceName}</td>
              <td className="px-4 py-3 font-mono text-xs">{d.deviceIdentifier}</td>
              {codes.map((c, i) => (
                <td key={c} className="px-4 py-3 tabular" style={{ color: color(i) }}>
                  {d.counts[c] ?? 0}
                </td>
              ))}
              <td className="px-4 py-3 tabular">{d.total}</td>
              <td className="px-4 py-3">{d.active ? "Active" : "Inactive"}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Daily trend">
        <Table head={["Date", ...codes, "Total", ...codes.map((c) => `Cumulative ${c}`), "Leader"]}>
          {[...a.byDay].reverse().map((d) => (
            <tr key={d.day}>
              <td className="px-4 py-2 font-mono text-xs">{d.day}</td>
              {codes.map((c, i) => (
                <td key={c} className="px-4 py-2 tabular" style={{ color: color(i) }}>
                  {d.counts[c] ?? 0}
                </td>
              ))}
              <td className="px-4 py-2 tabular">{d.total}</td>
              {codes.map((c) => (
                <td key={`cum-${c}`} className="px-4 py-2 tabular">
                  {d.cumulative[c] ?? 0}
                </td>
              ))}
              <td className="px-4 py-2">{leaderOf(d.counts) ?? (d.total ? "Tie" : "—")}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
