import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Rawia Admin — Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdminSession()) redirect("/admin");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/admin";
  return (
    <main className="bg-arena flex min-h-screen items-center justify-center px-4 text-cream">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/40 p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-cream/50">Rawia Cafe</p>
        <h1 className="mt-1 font-display text-2xl">University Battle Admin</h1>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
