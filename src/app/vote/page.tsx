import type { Metadata } from "next";
import { KioskApp } from "@/components/kiosk/kiosk-app";

export const metadata: Metadata = {
  title: "Rawia University Battle — Vote",
};

export const dynamic = "force-dynamic";

export default function VotePage() {
  return <KioskApp />;
}
