"use client";

import { useState } from "react";

/**
 * Shown when the browser has no valid kiosk token. Rawia staff paste the device token
 * (created in Admin → Devices) once; it is then stored in an httpOnly cookie.
 */
export function KioskSetup({ message, onRegistered }: { message?: string; onRegistered: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not register this kiosk.");
        return;
      }
      onRegistered();
    } catch {
      setError("Network error. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="eyebrow text-ink-soft">Rawia staff only</p>
      <h1 className="font-display text-3xl md:text-5xl text-ink">Kiosk not authorised</h1>
      <p className="max-w-xl text-ink-soft">{message ?? "Enter this kiosk's device token to enable voting on this screen."}</p>
      <form onSubmit={submit} className="flex w-full max-w-xl flex-col gap-3">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="rk_…"
          className="rounded-xl border-2 border-ink/15 bg-white/60 px-4 py-4 text-center font-mono text-lg text-ink outline-none focus:border-brick select-text"
          style={{ userSelect: "text", WebkitUserSelect: "text" }}
        />
        <button
          type="submit"
          disabled={busy || token.trim().length < 16}
          className="rounded-xl bg-brick px-6 py-4 font-display text-lg text-apricot disabled:opacity-50"
        >
          {busy ? "Checking…" : "Authorise this kiosk"}
        </button>
        {error && <p className="text-brick">{error}</p>}
      </form>
    </div>
  );
}
