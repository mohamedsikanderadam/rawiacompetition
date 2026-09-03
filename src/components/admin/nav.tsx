"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/votes", label: "Votes" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/devices", label: "Devices" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-gold/15 text-gold" : "text-cream/70 hover:bg-white/5 hover:text-cream"}`}
          >
            {l.label}
          </Link>
        );
      })}
      <div className="hidden border-t border-white/10 pt-2 md:block" />
      <a href="/battle" target="_blank" rel="noreferrer" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-cream/50 hover:text-cream">
        Public leaderboard ↗
      </a>
      <a href="/vote" target="_blank" rel="noreferrer" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-cream/50 hover:text-cream">
        Kiosk ↗
      </a>
    </nav>
  );
}
