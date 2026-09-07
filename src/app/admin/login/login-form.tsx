"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { Field, buttonClass, inputClass } from "@/components/admin/ui";

export function LoginForm({ next }: { next: string }) {
  const [result, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Username">
        <input name="username" type="text" required autoComplete="username" autoCapitalize="none" className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      {result && !result.ok && <p className="text-sm text-red-400">{result.message}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
