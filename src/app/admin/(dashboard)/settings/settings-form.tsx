"use client";

import { useActionState } from "react";
import type { Campaign } from "@/db/schema";
import type { CampaignPhase } from "@/lib/battle";
import { Card, Field, Toggle, buttonClass, inputClass } from "@/components/admin/ui";
import { saveSettingsAction } from "../../actions";

export function SettingsForm({ campaign, phase }: { campaign: Campaign; phase: CampaignPhase }) {
  const [result, action, pending] = useActionState(saveSettingsAction, null);
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

      <Card title="Contestants">
        <p className="mb-4 text-sm text-cream/70">
          Any two names work — universities today, <em>Nissan Patrol vs Land Cruiser</em> tomorrow. Short codes appear on the big cards (e.g. <code>UOS</code>,{" "}
          <code>PATROL</code>); full names appear beneath them.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-uos/40 p-4">
            <p className="text-xs uppercase tracking-widest text-uos">Contestant 01 · Brick Red card</p>
            <Field label="Short code (max 12)">
              <input name="universityACode" defaultValue={campaign.universityACode} required maxLength={12} className={inputClass} />
            </Field>
            <Field label="Full name">
              <input name="universityAName" defaultValue={campaign.universityAName} required className={inputClass} />
            </Field>
          </div>
          <div className="space-y-3 rounded-xl border border-aus/40 p-4">
            <p className="text-xs uppercase tracking-widest text-aus">Contestant 02 · Dark Coffee card</p>
            <Field label="Short code (max 12)">
              <input name="universityBCode" defaultValue={campaign.universityBCode} required maxLength={12} className={inputClass} />
            </Field>
            <Field label="Full name">
              <input name="universityBName" defaultValue={campaign.universityBName} required className={inputClass} />
            </Field>
          </div>
        </div>
        <p className="mt-3 text-xs text-cream/50">
          Votes are stored under the short code. Changing a code mid-campaign hides votes recorded under the old code — use <strong>Reset scores</strong> on the Overview
          when switching to a new campaign.
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
          Shown on /vote and /battle as “<span className="text-cream">{campaign.headline}</span> <span className="text-uos">{campaign.headlineAccent}</span>”. For a car
          campaign try “Which legend / rules the dunes?”.
        </p>
      </Card>

      <Card title="Kiosk experience">
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            name="showScoresOnVote"
            label="Show live scores on voting screen"
            defaultChecked={campaign.showScoresOnVote}
            hint="OFF: voters only see the headline and the two cards, with no numbers."
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
