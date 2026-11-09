import type { ImportReport } from "@/lib/importers";

export function ImportResult({ state }: { state: ImportReport | { error: string } | undefined }) {
  if (!state) return null;
  if ("error" in state) return <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>;
  return (
    <div role="status" className="space-y-2 text-sm">
      <p className="rounded-lg bg-success-soft px-3 py-2 text-success">{state.created} added, {state.updated} updated{state.errors.length ? `, ${state.errors.length} rows skipped` : ""}.</p>
      {state.errors.length > 0 && (
        <ul className="max-h-48 overflow-auto rounded-lg bg-danger-soft px-3 py-2 text-danger">
          {state.errors.slice(0, 200).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
        </ul>
      )}
    </div>
  );
}
