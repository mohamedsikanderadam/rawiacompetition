import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hashPassword } from "../src/lib/auth";
import { getCampaign } from "../src/lib/campaign";
import { resetDemoData } from "../src/lib/demo";
import { generateDeviceToken, hashToken } from "../src/lib/votes";

/**
 * Idempotent seed:
 *  - ensures the campaign row exists
 *  - creates the initial admin (ADMIN_EMAIL / ADMIN_PASSWORD) if missing
 *  - registers RAWIA-KIOSK-01 (token from KIOSK_SEED_TOKEN or random, printed once)
 *  - optionally loads demo votes (SEED_DEMO_DATA=true, only when the campaign has no votes yet)
 */
async function main() {
  const campaign = await getCampaign();
  console.log(`Campaign: ${campaign.name} (${campaign.startDate} → ${campaign.endDate}) mode=${campaign.mode}`);

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || password.length < 12) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD (>= 12 chars) must be set to seed the admin account.");
  }
  const existingAdmin = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email)).limit(1);
  if (existingAdmin[0]) {
    console.log(`Admin exists: ${email}`);
  } else {
    await db.insert(schema.adminUsers).values({ email, passwordHash: await hashPassword(password) });
    console.log(`Admin created: ${email}`);
  }

  const identifier = "RAWIA-KIOSK-01";
  let device = (await db.select().from(schema.devices).where(eq(schema.devices.deviceIdentifier, identifier)).limit(1))[0];
  if (!device) {
    const token = process.env.KIOSK_SEED_TOKEN || generateDeviceToken();
    device = (
      await db
        .insert(schema.devices)
        .values({ deviceName: "Rawia Kiosk 1", deviceIdentifier: identifier, tokenHash: hashToken(token) })
        .returning()
    )[0];
    console.log(`Device created: ${identifier}`);
    console.log("");
    console.log("  KIOSK DEVICE TOKEN (shown once — enter it on the kiosk at /vote):");
    console.log(`  ${token}`);
    console.log("");
  } else {
    console.log(`Device exists: ${identifier}`);
  }

  if ((process.env.SEED_DEMO_DATA ?? "true") !== "false") {
    const voteCount = await db.$count(schema.votes, eq(schema.votes.campaignId, campaign.id));
    if (voteCount === 0 && campaign.mode === "demo") {
      const t = await resetDemoData(campaign, device);
      console.log(`Demo votes loaded: ${campaign.universityACode} ${t.a} / ${campaign.universityBCode} ${t.b}`);
    } else {
      console.log(`Skipping demo data (existing votes: ${voteCount}, mode: ${campaign.mode})`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
