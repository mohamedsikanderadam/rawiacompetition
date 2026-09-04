import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getCampaign } from "@/lib/campaign";
import { AdminNav } from "@/components/admin/nav";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const campaign = await getCampaign();

  return (
    <div className="bg-admin flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full flex-col border-b border-white/10 bg-black/40 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="px-5 py-5">
          <p className="text-xs uppercase tracking-[0.3em] text-cream/50">Rawia Cafe</p>
          <h1 className="font-display text-lg leading-tight">{campaign.name}</h1>
          {campaign.mode === "demo" && (
            <span className="mt-2 inline-block rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-semibold uppercase text-amber-300">Demo data</span>
          )}
        </div>
        <AdminNav />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/10 px-5 py-4 text-sm">
          <span className="truncate text-cream/60" title={session.email}>
            {session.email}
          </span>
          <form action={logoutAction}>
            <button type="submit" className="text-cream/70 hover:text-cream">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
