import type { Metadata } from "next";
import { getCampaign } from "@/lib/campaign";
import { buildPublicState } from "@/lib/kiosk";
import { BattleBoard } from "@/components/battle/battle-board";

export const metadata: Metadata = {
  title: "Rawia University Battle — Live Score",
};

export const dynamic = "force-dynamic";

export default async function BattlePage() {
  const campaign = await getCampaign();
  const state = await buildPublicState(campaign);
  return <BattleBoard initial={state} />;
}
