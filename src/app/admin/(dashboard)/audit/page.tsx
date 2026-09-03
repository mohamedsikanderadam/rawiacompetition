import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatLocalDateTime } from "@/lib/time";
import { Table } from "@/components/admin/ui";

const ACTION_LABELS: Record<string, string> = {
  "vote.invalidated": "Invalidated vote",
  "vote.restored": "Restored vote",
  "settings.updated": "Updated settings",
  "device.created": "Created device",
  "device.activated": "Activated device",
  "device.deactivated": "Deactivated device",
  "device.token_rotated": "Rotated device token",
  "campaign.demo_data_reset": "Reset demo data",
  "campaign.started_live": "Started live campaign",
  "admin.login": "Signed in",
  "admin.logout": "Signed out",
};

export default async function AuditPage() {
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt), desc(schema.auditLogs.id)).limit(500);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">AUDIT LOG</h1>
        <p className="text-cream/60">Every administrative action, newest first (last 500).</p>
      </header>
      <Table head={["When", "Admin", "Action", "Vote", "Reason / details"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-cream/50">
              No administrative actions yet.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3 whitespace-nowrap text-cream/80">{formatLocalDateTime(r.createdAt)}</td>
            <td className="px-4 py-3">{r.adminEmail}</td>
            <td className="px-4 py-3 font-medium">{ACTION_LABELS[r.action] ?? r.action}</td>
            <td className="px-4 py-3 font-mono text-xs">{r.voteId ? `#${r.voteId}` : "—"}</td>
            <td className="px-4 py-3 text-cream/70">
              {r.reason && <span>{r.reason}</span>}
              {r.details != null && Object.keys(r.details as object).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-cream/50">details</summary>
                  <pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 text-xs">{JSON.stringify(r.details, null, 2)}</pre>
                </details>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
