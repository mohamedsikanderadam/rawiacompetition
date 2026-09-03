import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { getCampaign } from "@/lib/campaign";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatLocalDate, formatLocalTime, localDateKey, localDayEnd, localDayStart } from "@/lib/time";

export const dynamic = "force-dynamic";

/** GET /api/admin/export/votes.csv — one row per vote record. Accepts the same filters as /admin/votes. */
export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const campaign = await getCampaign();
  const conds: SQL[] = [eq(schema.votes.campaignId, campaign.id)];
  const university = url.searchParams.get("university");
  const status = url.searchParams.get("status");
  const device = Number(url.searchParams.get("device")) || 0;
  const date = url.searchParams.get("date") ?? "";
  if (university) conds.push(eq(schema.votes.university, university));
  if (status === "valid" || status === "invalid") conds.push(eq(schema.votes.status, status));
  if (device) conds.push(eq(schema.votes.deviceId, device));
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) conds.push(gte(schema.votes.createdAt, localDayStart(date)), lt(schema.votes.createdAt, localDayEnd(date)));

  const rows = await db
    .select({
      id: schema.votes.id,
      university: schema.votes.university,
      createdAt: schema.votes.createdAt,
      status: schema.votes.status,
      invalidReason: schema.votes.invalidReason,
      deviceIdentifier: schema.devices.deviceIdentifier,
    })
    .from(schema.votes)
    .innerJoin(schema.devices, eq(schema.votes.deviceId, schema.devices.id))
    .where(and(...conds))
    .orderBy(desc(schema.votes.createdAt));

  const csv = toCsv([
    ["Vote ID", "University", "Date", "Time", "Device", "Status", "Invalid Reason", "Timestamp (UTC)"],
    ...rows.map((r) => [r.id, r.university, formatLocalDate(r.createdAt), formatLocalTime(r.createdAt), r.deviceIdentifier, r.status, r.invalidReason ?? "", r.createdAt.toISOString()]),
  ]);
  await db.insert(schema.auditLogs).values({ adminUserId: admin.id, adminEmail: admin.email, action: "export.votes", details: { rows: rows.length, filters: Object.fromEntries(url.searchParams) } });
  return csvResponse(`rawia-battle-votes-${localDateKey()}.csv`, csv);
}
