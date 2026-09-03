import { getAnalytics } from "@/lib/analytics";
import { getCampaignStatus } from "@/lib/battle";
import { getCampaign, getScoreboard } from "@/lib/campaign";
import { Card, Stat, Table } from "@/components/admin/ui";

export default async function AnalyticsPage() {
  const campaign = await getCampaign();
  const [board, a] = await Promise.all([getScoreboard(campaign), getAnalytics(campaign)]);
  const status = getCampaignStatus(campaign);
  const maxDay = Math.max(1, ...a.byDay.map((d) => d.total));
  const maxHour = Math.max(1, ...a.byHour.map((h) => h.total));
  const maxCum = Math.max(1, ...a.byDay.map((d) => Math.max(d.cumulativeA, d.cumulativeB)));
  const A = campaign.universityACode;
  const B = campaign.universityBCode;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">CAMPAIGN ANALYTICS</h1>
        <p className="text-cream/60">All figures count valid votes only, in Rawia local time.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total votes" value={board.total.toLocaleString()} />
        <Stat label={`${A} votes`} value={board.a.votes.toLocaleString()} hint={`${board.a.pct}%`} tone="a" />
        <Stat label={`${B} votes`} value={board.b.votes.toLocaleString()} hint={`${board.b.pct}%`} tone="b" />
        <Stat label="Current leader" value={board.leader ?? (board.total ? "TIE" : "—")} hint={`difference: ${board.lead}`} tone="gold" />
        <Stat label="Votes today" value={a.today.total} hint={`${A} ${a.today.a} · ${B} ${a.today.b}`} />
        <Stat label="Votes yesterday" value={a.yesterday.total} hint={`${A} ${a.yesterday.a} · ${B} ${a.yesterday.b}`} />
        <Stat label="Average votes / day" value={a.averagePerDay} hint={`${a.daysElapsed} days elapsed · ${status.daysLeft} left`} />
        <Stat label="Highest participation day" value={a.peakDay?.total ?? "—"} hint={a.peakDay?.day} />
      </div>

      <Card title="Votes by day">
        <div className="flex h-56 items-end gap-1">
          {a.byDay.map((d) => (
            <div key={d.day} className="relative flex h-full flex-1 items-end" title={`${d.day}: ${A} ${d.a} · ${B} ${d.b}`}>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(d.total / maxDay) * 100}%` }}>
                <div className="bg-uos" style={{ flex: d.a }} />
                <div className="bg-aus" style={{ flex: d.b }} />
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
              <div key={h.hour} className="flex h-full flex-1 items-end" title={`${String(h.hour).padStart(2, "0")}:00 — ${A} ${h.a} · ${B} ${h.b}`}>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(h.total / maxHour) * 100}%` }}>
                  <div className="bg-uos" style={{ flex: h.a }} />
                  <div className="bg-aus" style={{ flex: h.b }} />
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
            {(["cumulativeA", "cumulativeB"] as const).map((key) => {
              const pts = a.byDay.map((d, i) => {
                const x = a.byDay.length === 1 ? 0 : (i / (a.byDay.length - 1)) * 400;
                const y = 176 - (d[key] / maxCum) * 170;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              });
              return (
                <polyline
                  key={key}
                  points={pts.join(" ")}
                  fill="none"
                  stroke={key === "cumulativeA" ? "var(--uos)" : "var(--aus)"}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="text-uos">
              ● {A} {board.a.votes}
            </span>
            <span className="text-aus">
              ● {B} {board.b.votes}
            </span>
          </div>
        </Card>
      </div>

      <Card title="Votes by device">
        <Table head={["Device", "Identifier", A, B, "Total", "Status"]}>
          {a.byDevice.map((d) => (
            <tr key={d.deviceId}>
              <td className="px-4 py-3">{d.deviceName}</td>
              <td className="px-4 py-3 font-mono text-xs">{d.deviceIdentifier}</td>
              <td className="px-4 py-3 text-uos tabular">{d.a}</td>
              <td className="px-4 py-3 text-aus tabular">{d.b}</td>
              <td className="px-4 py-3 tabular">{d.total}</td>
              <td className="px-4 py-3">{d.active ? "Active" : "Inactive"}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Daily trend">
        <Table head={["Date", A, B, "Total", `Cumulative ${A}`, `Cumulative ${B}`, "Leader"]}>
          {[...a.byDay].reverse().map((d) => (
            <tr key={d.day}>
              <td className="px-4 py-2 font-mono text-xs">{d.day}</td>
              <td className="px-4 py-2 text-uos tabular">{d.a}</td>
              <td className="px-4 py-2 text-aus tabular">{d.b}</td>
              <td className="px-4 py-2 tabular">{d.total}</td>
              <td className="px-4 py-2 tabular">{d.cumulativeA}</td>
              <td className="px-4 py-2 tabular">{d.cumulativeB}</td>
              <td className="px-4 py-2">{d.a === d.b ? (d.total ? "Tie" : "—") : d.a > d.b ? A : B}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
