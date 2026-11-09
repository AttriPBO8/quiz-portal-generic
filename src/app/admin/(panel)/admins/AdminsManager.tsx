"use client";

import { useActionState, useState, useTransition } from "react";
import { createAdmin, resetAdminPassword, setAdminActive } from "@/app/actions/admin-content";

type A = { id: string; username: string; name: string; role: string; active: boolean; users: number; quizzes: number };

export function AdminsManager({ admins, meId }: { admins: A[]; meId: string }) {
  const [state, action, pending] = useActionState(createAdmin, undefined);
  const [newPw, setNewPw] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  return (
    <>
      <details className="card p-4" open={!!state?.error}>
        <summary className="cursor-pointer font-semibold">Add an admin</summary>
        <form action={action} className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
          <label><span className="label">Username</span><input className="input" name="username" autoCapitalize="none" required /></label>
          <label><span className="label">Full name</span><input className="input" name="name" required /></label>
          <label><span className="label">Role</span><select className="input" name="role"><option value="LOCAL_ADMIN">Local Admin</option><option value="SUPER_ADMIN">Super Admin</option></select></label>
          <button className="btn btn-primary" disabled={pending}>Add admin</button>
        </form>
        {state?.error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
        {state?.created && (
          <p role="status" className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            Added <strong>{state.created.username}</strong>. Their password is <code className="font-bold">{state.created.password}</code>. Share it privately; it is shown only once. They can change it after signing in.
          </p>
        )}
      </details>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th className="text-right">Users</th><th className="text-right">Quizzes</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className={a.active ? "" : "opacity-60"}>
                <td className="font-medium">{a.name}</td><td>{a.username}</td><td>{a.role}</td>
                <td className="text-right">{a.users}</td><td className="text-right">{a.role === "Local Admin" ? a.quizzes : "All"}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.active ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{a.active ? "Active" : "Inactive"}</span></td>
                <td className="whitespace-nowrap">
                  {a.id === meId ? <span className="text-sm text-muted">You</span> : (
                    <span className="flex flex-wrap items-center gap-3 text-sm">
                      {newPw[a.id] ? <span>New password: <code className="font-bold">{newPw[a.id]}</code></span> : (
                        <button className="text-primary underline" disabled={busy} onClick={() => start(async () => { const p = await resetAdminPassword(a.id); setNewPw((s) => ({ ...s, [a.id]: p })); })}>Reset password</button>
                      )}
                      <button className={a.active ? "text-danger underline" : "text-primary underline"} disabled={busy} onClick={() => start(() => setAdminActive(a.id, !a.active))}>{a.active ? "Deactivate" : "Activate"}</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
