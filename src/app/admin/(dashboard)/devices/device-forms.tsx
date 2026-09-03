"use client";

import { useActionState } from "react";
import { Field, buttonClass, buttonGhostClass, inputClass } from "@/components/admin/ui";
import { createDeviceAction, rotateDeviceTokenAction, type ActionResult } from "../../actions";

function TokenReveal({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (!result.ok) return <p className="text-sm text-red-400">{result.message}</p>;
  return (
    <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
      <p className="text-sm text-cream/80">{result.message}</p>
      {result.token && (
        <code className="mt-2 block select-all break-all rounded-lg bg-black/40 p-3 font-mono text-sm text-gold" style={{ userSelect: "all" }}>
          {result.token}
        </code>
      )}
    </div>
  );
}

export function CreateDeviceForm() {
  const [result, action, pending] = useActionState(createDeviceAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Device name">
          <input name="deviceName" required placeholder="Rawia Kiosk 2" className={inputClass} />
        </Field>
        <Field label="Identifier" hint="Shown in vote records and exports.">
          <input name="deviceIdentifier" required placeholder="RAWIA-KIOSK-02" className={inputClass} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating…" : "Create device & generate token"}
      </button>
      <TokenReveal result={result} />
    </form>
  );
}

export function RotateTokenForm({ deviceId }: { deviceId: number }) {
  const [result, action, pending] = useActionState(rotateDeviceTokenAction, null);
  return (
    <div className="space-y-2">
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm("Rotate this device's token? The kiosk will stop working until the new token is entered.")) e.preventDefault();
        }}
      >
        <input type="hidden" name="deviceId" value={deviceId} />
        <button type="submit" disabled={pending} className={`${buttonGhostClass} text-xs`}>
          {pending ? "Rotating…" : "Rotate token"}
        </button>
      </form>
      <TokenReveal result={result} />
    </div>
  );
}
