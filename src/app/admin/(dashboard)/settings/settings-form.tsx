"use client";

import { useActionState, useState } from "react";
import type { Campaign } from "@/db/schema";
import { MAX_CONTESTANTS, MIN_CONTESTANTS, type CampaignPhase, type Contestant } from "@/lib/battle";
import { Card, Field, Toggle, buttonClass, buttonGhostClass, inputClass } from "@/components/admin/ui";
import { CONTESTANT_COLORS, contestantColor, contestantLabel } from "@/components/battle/scoreboard";
import { saveSettingsAction } from "../../actions";

const COLOR_NAMES = ["Brick Red", "Dark Coffee", "Dusty Olive", "Tan", "Deep Brick", "Pitch Black"] as const;

type Row = Contestant & { key: number };

export function SettingsForm({ campaign, contestants, phase }: { campaign: Campaign; contestants: Contestant[]; phase: CampaignPhase }) {
  const [result, action, pending] = useActionState(saveSettingsAction, null);
  const [rows, setRows] = useState<Row[]>(() => contestants.map((c, key) => ({ ...c, key })));
  const [nextKey, setNextKey] = useState(contestants.length);

  const addRow = () => {
    if (rows.length >= MAX_CONTESTANTS) return;
    setRows([...rows, { key: nextKey, code: "", name: "" }]);
    setNextKey(nextKey + 1);
  };
  const removeRow = (key: number) => {
    if (rows.length <= MIN_CONTESTANTS) return;
    setRows(rows.filter((r) => r.key !== key));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [r] = next.splice(from, 1);
    next.splice(to, 0, r);
    setRows(next);
  };
  return (
    <form action={action} className="space-y-6">
      <Card title="Campaign">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Campaign name">
            <input name="name" defaultValue={campaign.name} required className={inputClass} />
          </Field>
          <Field label="Start date">
            <input type="date" name="startDate" defaultValue={campaign.startDate} required className={inputClass} />
          </Field>
          <Field label="End date">
            <input type="date" name="endDate" defaultValue={campaign.endDate} required className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title={`Contestants (${rows.length} of ${MAX_CONTESTANTS})`}>
        <p className="mb-4 text-sm text-cream/70">
          Add between {MIN_CONTESTANTS} and {MAX_CONTESTANTS} contestants — universities today, <em>Nissan Patrol vs Land Cruiser</em> tomorrow. Short codes appear on the big
          cards (e.g. <code>UOS</code>, <code>PATROL</code>); full names appear beneath them. Cards are shown in this order.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row, i) => (
            <div key={row.key} className="space-y-3 rounded-xl border p-4" style={{ borderColor: `${contestantColor(i, "dark")}66` }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-widest" style={{ color: contestantColor(i, "dark") }}>
                  {contestantLabel(i)} · {COLOR_NAMES[i % COLOR_NAMES.length]} card
                </p>
                <div className="flex gap-1 text-xs">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded px-2 py-1 text-cream/70 hover:bg-white/10 disabled:opacity-30" aria-label="Move up">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === rows.length - 1}
                    className="rounded px-2 py-1 text-cream/70 hover:bg-white/10 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length <= MIN_CONTESTANTS}
                    className="rounded px-2 py-1 text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                    title={rows.length <= MIN_CONTESTANTS ? `Keep at least ${MIN_CONTESTANTS} contestants` : "Remove contestant"}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <Field label="Short code (max 12)">
                <input
                  name="contestantCode"
                  value={row.code}
                  onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, code: e.target.value } : r)))}
                  required
                  maxLength={12}
                  placeholder="e.g. UOS"
                  className={`${inputClass} uppercase`}
                />
              </Field>
              <Field label="Full name">
                <input
                  name="contestantName"
                  value={row.name}
                  onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))}
                  required
                  maxLength={120}
                  placeholder="e.g. University of Sharjah"
                  className={inputClass}
                />
              </Field>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={addRow} disabled={rows.length >= MAX_CONTESTANTS} className={buttonGhostClass}>
            + Add contestant
          </button>
          {rows.length >= MAX_CONTESTANTS && <span className="text-xs text-cream/50">Maximum of {MAX_CONTESTANTS} reached.</span>}
        </div>
        <p className="mt-3 text-xs text-cream/50">
          Votes are stored under the short code. Removing a contestant or changing a code mid-campaign hides votes recorded under the old code — use{" "}
          <strong>Reset scores</strong> on the Overview when switching to a new campaign. Card colours follow the Rawia palette in this order:{" "}
          {CONTESTANT_COLORS.map((_, i) => COLOR_NAMES[i]).join(", ")}.
        </p>
      </Card>

      <Card title="Kiosk headline">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Headline (dark)">
            <input name="headline" defaultValue={campaign.headline} required maxLength={60} className={inputClass} />
          </Field>
          <Field label="Headline (red accent)">
            <input name="headlineAccent" defaultValue={campaign.headlineAccent} required maxLength={60} className={inputClass} />
          </Field>
          <Field label="Subline">
            <input name="subline" defaultValue={campaign.subline} required maxLength={160} className={inputClass} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-cream/50">
          Shown on /vote and /battle as “<span className="text-cream">{campaign.headline}</span> <span className="text-[#e0644f]">{campaign.headlineAccent}</span>”. For a car
          campaign try “Which legend / rules the dunes?”.
        </p>
      </Card>

      <Card title="Kiosk experience">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            name="showScoresOnVote"
            label="Show live scores on voting screen"
            defaultChecked={campaign.showScoresOnVote}
            hint="OFF: voters only see the headline and the contestant cards, with no numbers."
          />
          <Toggle
            name="showConfirmationScore"
            label="Show score after voting"
            defaultChecked={campaign.showConfirmationScore}
            hint="OFF: the confirmation just says “Your vote is in”."
          />
          <Toggle name="attractEnabled" label="Attract screen when idle" defaultChecked={campaign.attractEnabled} hint="Animated “tap to represent” screen after inactivity." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Confirmation duration (ms)" hint="1000 – 10000">
              <input type="number" name="confirmationDurationMs" min={1000} max={10000} step={100} defaultValue={campaign.confirmationDurationMs} className={inputClass} />
            </Field>
            <Field label="Attract timeout (ms)" hint="10000 – 600000">
              <input type="number" name="attractTimeoutMs" min={10000} max={600000} step={1000} defaultValue={campaign.attractTimeoutMs} className={inputClass} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Voting control">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle name="active" label="Campaign active" defaultChecked={campaign.active} hint="OFF pauses voting immediately; the kiosk shows “Voting is paused”." />
          <Toggle
            name="reopened"
            label="Manually reopen after end date"
            defaultChecked={campaign.reopened}
            hint="Accept votes even after the end date has passed. Turn off to close the battle again."
          />
        </div>
        <p className="mt-3 text-sm text-cream/60">
          Current status: <span className="font-semibold text-cream">{phase}</span>
        </p>
      </Card>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {result && <p className={result.ok ? "text-emerald-300" : "text-red-400"}>{result.message}</p>}
      </div>
    </form>
  );
}
