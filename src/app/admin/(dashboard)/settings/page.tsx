import { getCampaignStatus } from "@/lib/battle";
import { getCampaign, getContestants } from "@/lib/campaign";
import { CAMPAIGN_TZ } from "@/lib/time";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const campaign = await getCampaign();
  const status = getCampaignStatus(campaign);
  const contestants = (await getContestants(campaign)).map((c) => ({ code: c.code, name: c.name }));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">CAMPAIGN SETTINGS</h1>
        <p className="text-cream/60">
          Changes reach the kiosk within ~15 seconds — no reload required. Dates are in {CAMPAIGN_TZ}; the campaign ends at midnight after the end date.
        </p>
      </header>
      <SettingsForm campaign={campaign} contestants={contestants} phase={status.phase} />
    </div>
  );
}
