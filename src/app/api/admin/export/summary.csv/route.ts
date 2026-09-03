import { db, schema } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { determineWinner, getCampaignStatus } from "@/lib/battle";
import { getCampaign, getScoreboard } from "@/lib/campaign";
import { csvResponse, toCsv } from "@/lib/csv";
import { localDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

/** GET /api/admin/export/summary.csv — campaign totals, winner and margin. */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const campaign = await getCampaign();
  const board = await getScoreboard(campaign);
  const status = getCampaignStatus(campaign);
  const winner = determineWinner(board);
  const final = status.phase === "ended";

  const csv = toCsv([
    ["Field", "Value"],
    ["Campaign", campaign.name],
    [`${board.a.code} Total`, board.a.votes],
    [`${board.b.code} Total`, board.b.votes],
    ["Total Votes", board.total],
    [final ? "Winner" : "Current Leader", "tie" in winner ? "TIE" : winner.code],
    [final ? "Winning Margin" : "Current Margin", winner.margin],
    ["Campaign Start", campaign.startDate],
    ["Campaign End", campaign.endDate],
    ["Status", status.phase],
    ["Generated At (UTC)", new Date().toISOString()],
  ]);
  await db.insert(schema.auditLogs).values({ adminUserId: admin.id, adminEmail: admin.email, action: "export.summary" });
  return csvResponse(`rawia-battle-summary-${localDateKey()}.csv`, csv);
}
