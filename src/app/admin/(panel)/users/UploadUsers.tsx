"use client";

import { useActionState } from "react";
import { uploadUsers } from "@/app/actions/admin-users";
import { ImportResult } from "@/components/ImportResult";

export function UploadUsers() {
  const [state, action, pending] = useActionState(uploadUsers, undefined);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Add or update users from a CSV file</summary>
      <p className="mt-2 text-sm text-muted">
        Columns: <code>district, block, role_type, phone, name, local_admin, password</code>. The last two are optional.
        New users without a password get the starting password. A user with the same district, block, role and phone is updated.{" "}
        <a className="text-primary underline" href="/admin/export/users-template">Download a template</a>.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <input type="file" name="file" accept=".csv,text/csv" className="text-sm" required />
        <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>
      </form>
      <div className="mt-3"><ImportResult state={state} /></div>
    </details>
  );
}
