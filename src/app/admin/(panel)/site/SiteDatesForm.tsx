"use client";

import { useActionState } from "react";
import { saveQuizSiteDates } from "@/app/actions/admin-site";

export function SiteDatesForm({ opensAt, closesAt }: { opensAt: string; closesAt: string }) {
  const [state, action, pending] = useActionState(saveQuizSiteDates, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">Opens (India time)</span><input className="input" type="datetime-local" name="opensAt" defaultValue={opensAt} /></label>
        <label><span className="label">Closes (India time)</span><input className="input" type="datetime-local" name="closesAt" defaultValue={closesAt} /></label>
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-success">{state.ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save dates"}</button>
        <button className="btn btn-secondary" name="clear" value="1" disabled={pending}>Clear (always open)</button>
      </div>
    </form>
  );
}
