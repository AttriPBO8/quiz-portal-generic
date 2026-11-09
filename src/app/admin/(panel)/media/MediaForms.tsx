"use client";

import { useActionState, useState, useTransition } from "react";
import { removeMedia, updateMediaAlt, uploadMedia } from "@/app/actions/admin-media";

const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.mp3,.m4a,.ogg,.wav,.mp4,.webm";

export function UploadMedia() {
  const [state, action, pending] = useActionState(uploadMedia, undefined);
  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label><span className="label">File</span><input type="file" name="file" accept={ACCEPT} className="text-sm" required /></label>
      <label><span className="label">Description (needed for pictures)</span><input className="input" name="altText" maxLength={300} placeholder="e.g. Bar chart of monthly sales" /></label>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-3">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success sm:col-span-3">{state.ok}</p>}
    </form>
  );
}

export function MediaActions({ id, altText }: { id: string; altText: string }) {
  const [alt, setAlt] = useState(altText);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="mt-auto space-y-2">
      <label className="block"><span className="label">Description</span>
        <input className="input" value={alt} maxLength={300} onChange={(e) => setAlt(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary px-3 py-1 text-sm" disabled={busy || alt === altText} onClick={() => start(async () => { await updateMediaAlt(id, alt); setMessage("Saved."); })}>Save description</button>
        <button className="btn btn-secondary px-3 py-1 text-sm text-danger" disabled={busy}
          onClick={() => { if (confirm("Delete this file? This cannot be undone.")) start(async () => setMessage(await removeMedia(id))); }}>
          Delete
        </button>
      </div>
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
    </div>
  );
}
