import type { ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      {title && <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-cream/50">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "a" | "b" | "gold" }) {
  const color = tone === "a" ? "text-uos" : tone === "b" ? "text-aus" : tone === "gold" ? "text-gold" : "text-cream";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/50">{label}</p>
      <p className={`mt-2 font-display text-4xl tabular ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-cream/60">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-cream outline-none focus:border-gold disabled:opacity-50";
export const buttonClass = "rounded-lg bg-gold px-4 py-2 font-semibold text-background hover:bg-gold/90 disabled:opacity-50";
export const buttonGhostClass = "rounded-lg border border-white/15 px-4 py-2 font-semibold text-cream hover:bg-white/5 disabled:opacity-50";
export const buttonDangerClass = "rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500 disabled:opacity-50";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-cream/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-cream/50">{hint}</span>}
    </label>
  );
}

export function Toggle({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/[0.03]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-5 w-5 accent-[var(--gold)]" />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-cream/50">{hint}</span>}
      </span>
    </label>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-cream/50">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function UniBadge({ code, a }: { code: string; a: string }) {
  const cls = code === a ? "bg-uos/20 text-uos" : "bg-aus/20 text-aus";
  return <span className={`inline-block rounded-md px-2 py-0.5 font-display text-xs ${cls}`}>{code}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls = status === "valid" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300";
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${cls}`}>{status}</span>;
}
