"use client";

import Link from "next/link";
import { useActionState } from "react";

type State = { error?: string; ok?: string } | undefined;

export function PasswordForm({ action, backHref, currentLabel = "Current password" }: {
  action: (s: State, f: FormData) => Promise<State>;
  /** Where Back goes. Leave out to hide Back (when changing the password is required). */
  backHref?: string;
  currentLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div><label className="label" htmlFor="current">{currentLabel}</label><input id="current" name="current" type="password" className="input" autoComplete="current-password" required /></div>
      <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" className="input" autoComplete="new-password" minLength={8} maxLength={64} required /></div>
      <div><label className="label" htmlFor="confirm">New password again</label><input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required /></div>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">{state.ok}</p>}
      <div className="flex gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
        {backHref && <Link href={backHref} className="btn btn-secondary">Back</Link>}
      </div>
    </form>
  );
}
