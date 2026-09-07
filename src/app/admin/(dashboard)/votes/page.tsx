import Link from "next/link";
import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCampaign } from "@/lib/campaign";
import { formatLocalDate, formatLocalTime, localDateKey, localDayEnd, localDayStart } from "@/lib/time";
import { Card, StatusBadge, Table, UniBadge, buttonDangerClass, buttonGhostClass, inputClass } from "@/components/admin/ui";
import { invalidateVoteAction, restoreVoteAction } from "../../actions";

const PAGE_SIZE = 50;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function VotesPage({ searchParams }: PageProps<"/admin/votes">) {
  const sp = await searchParams;
  const campaign = await getCampaign();
  const devices = await db.select().from(schema.devices).orderBy(schema.devices.id);

  const university = str(sp.university);
  const date = str(sp.date);
  const from = str(sp.from);
  const to = str(sp.to);
  const deviceId = Number(str(sp.device)) || 0;
  const status = str(sp.status);
  const page = Math.max(1, Number(str(sp.page)) || 1);

  const conds: SQL[] = [eq(schema.votes.campaignId, campaign.id)];
  if (university) conds.push(eq(schema.votes.university, university));
  if (status === "valid" || status === "invalid") conds.push(eq(schema.votes.status, status));
  if (deviceId) conds.push(eq(schema.votes.deviceId, deviceId));
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [fh, fm] = /^\d{2}:\d{2}$/.test(from) ? from.split(":").map(Number) : [0, 0];
    const [th, tm] = /^\d{2}:\d{2}$/.test(to) ? to.split(":").map(Number) : [24, 0];
    const start = new Date(localDayStart(date).getTime() + (fh * 60 + fm) * 60_000);
    const end = th >= 24 ? localDayEnd(date) : new Date(localDayStart(date).getTime() + (th * 60 + tm) * 60_000);
    conds.push(gte(schema.votes.createdAt, start), lt(schema.votes.createdAt, end));
  }
  const where = and(...conds);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: schema.votes.id,
        university: schema.votes.university,
        createdAt: schema.votes.createdAt,
        status: schema.votes.status,
        sessionId: schema.votes.sessionId,
        invalidReason: schema.votes.invalidReason,
        deviceName: schema.devices.deviceName,
        deviceIdentifier: schema.devices.deviceIdentifier,
      })
      .from(schema.votes)
      .innerJoin(schema.devices, eq(schema.votes.deviceId, schema.devices.id))
      .where(where)
      .orderBy(desc(schema.votes.createdAt), desc(schema.votes.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(schema.votes).where(where),
  ]);
  const total = Number(totalRow[0]?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries({ university, date, from, to, device: deviceId ? String(deviceId) : "", status })) if (v) query.set(k, v);
  const pageHref = (p: number) => `/admin/votes?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">VOTES</h1>
          <p className="text-cream/60">{total.toLocaleString()} matching vote records. Invalidated votes stay in the database but are not counted.</p>
        </div>
        <a href={`/api/admin/export/votes.csv?${query}`} className={buttonGhostClass}>
          Export this view as CSV
        </a>
      </header>

      <Card title="Filter">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <select name="university" defaultValue={university} className={inputClass}>
            <option value="">All contestants</option>
            <option value={campaign.universityACode}>{campaign.universityACode}</option>
            <option value={campaign.universityBCode}>{campaign.universityBCode}</option>
          </select>
          <input type="date" name="date" defaultValue={date} className={inputClass} max={localDateKey()} />
          <input type="time" name="from" defaultValue={from} className={inputClass} title="From time (requires a date)" />
          <input type="time" name="to" defaultValue={to} className={inputClass} title="To time (requires a date)" />
          <select name="device" defaultValue={deviceId || ""} className={inputClass}>
            <option value="">All devices</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.deviceIdentifier}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className={inputClass}>
            <option value="">Valid + invalid</option>
            <option value="valid">Valid only</option>
            <option value="invalid">Invalid only</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className={buttonGhostClass}>
              Apply
            </button>
            <Link href="/admin/votes" className={buttonGhostClass}>
              Clear
            </Link>
          </div>
        </form>
      </Card>

      <Table head={["Vote ID", "Date", "Time", "Contestant", "Device", "Status", "Action"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-cream/50">
              No votes match these filters.
            </td>
          </tr>
        )}
        {rows.map((v) => (
          <tr key={v.id} className={v.status === "invalid" ? "opacity-60" : ""}>
            <td className="px-4 py-3 font-mono text-xs">#{v.id}</td>
            <td className="px-4 py-3 whitespace-nowrap">{formatLocalDate(v.createdAt)}</td>
            <td className="px-4 py-3 font-mono whitespace-nowrap">{formatLocalTime(v.createdAt)}</td>
            <td className="px-4 py-3">
              <UniBadge code={v.university} a={campaign.universityACode} />
            </td>
            <td className="px-4 py-3">
              <span title={v.deviceName}>{v.deviceIdentifier}</span>
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={v.status} />
              {v.invalidReason && <span className="ml-2 text-xs text-cream/50">{v.invalidReason}</span>}
            </td>
            <td className="px-4 py-3">
              {v.status === "valid" ? (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-red-300 hover:underline">Invalidate…</summary>
                  <form action={invalidateVoteAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="voteId" value={v.id} />
                    <input name="reason" required placeholder="Reason (e.g. accidental duplicate)" className={`${inputClass} min-w-56 text-xs`} />
                    <button type="submit" className={`${buttonDangerClass} text-xs`}>
                      Invalidate
                    </button>
                  </form>
                </details>
              ) : (
                <details>
                  <summary className="cursor-pointer text-xs text-emerald-300 hover:underline">Restore…</summary>
                  <form action={restoreVoteAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="voteId" value={v.id} />
                    <input name="reason" placeholder="Reason" className={`${inputClass} min-w-56 text-xs`} />
                    <button type="submit" className={`${buttonGhostClass} text-xs`}>
                      Restore
                    </button>
                  </form>
                </details>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm text-cream/70">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={buttonGhostClass}>
                ← Newer
              </Link>
            )}
            {page < pages && (
              <Link href={pageHref(page + 1)} className={buttonGhostClass}>
                Older →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
