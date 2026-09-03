import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCampaign } from "@/lib/campaign";
import { formatLocalDateTime } from "@/lib/time";
import { Card, Table, buttonGhostClass } from "@/components/admin/ui";
import { setDeviceActiveAction } from "../../actions";
import { CreateDeviceForm, RotateTokenForm } from "./device-forms";

export default async function DevicesPage() {
  const campaign = await getCampaign();
  const devices = await db.select().from(schema.devices).orderBy(schema.devices.id);
  const counts = await db
    .select({ deviceId: schema.votes.deviceId, n: count() })
    .from(schema.votes)
    .where(and(eq(schema.votes.campaignId, campaign.id), eq(schema.votes.status, "valid")))
    .groupBy(schema.votes.deviceId);
  const countBy = new Map(counts.map((c) => [c.deviceId, Number(c.n)]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">KIOSK DEVICES</h1>
        <p className="text-cream/60">
          Only registered devices can cast votes. Each device gets a secret token; enter it once on the kiosk at <code>/vote</code>. Tokens are stored hashed and cannot be
          recovered — rotate if lost.
        </p>
      </header>

      <Table head={["Device", "Identifier", "Valid votes", "Last vote", "Status", "Actions"]}>
        {devices.map((d) => (
          <tr key={d.id}>
            <td className="px-4 py-3">{d.deviceName}</td>
            <td className="px-4 py-3 font-mono text-xs">{d.deviceIdentifier}</td>
            <td className="px-4 py-3 tabular">{countBy.get(d.id) ?? 0}</td>
            <td className="px-4 py-3 text-cream/70">{d.lastSeenAt ? formatLocalDateTime(d.lastSeenAt) : "—"}</td>
            <td className="px-4 py-3">
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${d.active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                {d.active ? "active" : "inactive"}
              </span>
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <form action={setDeviceActiveAction}>
                  <input type="hidden" name="deviceId" value={d.id} />
                  <input type="hidden" name="active" value={d.active ? "false" : "true"} />
                  <button type="submit" className={`${buttonGhostClass} text-xs`}>
                    {d.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <RotateTokenForm deviceId={d.id} />
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Card title="Add a kiosk">
        <CreateDeviceForm />
      </Card>
    </div>
  );
}
