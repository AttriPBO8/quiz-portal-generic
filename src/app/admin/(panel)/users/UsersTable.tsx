"use client";

import { useState, useTransition } from "react";
import { resetPassword, setUserActive } from "@/app/actions/admin-users";

type U = { id: string; name: string; phone: string; role: string; district: string; block: string; localAdmin: string; active: boolean; ownPassword: boolean; locked: boolean };

export function UsersTable({ users, showLocalAdmin }: { users: U[]; showLocalAdmin: boolean }) {
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  const [menu, setMenu] = useState<string | null>(null);

  if (!users.length) return <p className="card px-4 py-8 text-center text-muted">No users match these filters.</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>District</th><th>Block</th><th>Role</th><th>Name</th><th>Phone</th>
            {showLocalAdmin && <th>Local Admin</th>}
            <th>Password</th><th>Status</th><th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.active ? "" : "opacity-60"}>
              <td>{u.district}</td><td>{u.block}</td><td>{u.role}</td><td className="font-medium">{u.name}</td><td className="tabular-nums">{u.phone}</td>
              {showLocalAdmin && <td>{u.localAdmin}</td>}
              <td className="whitespace-nowrap">
                <div>{u.ownPassword ? "Set by user" : "Starting password"}</div>
                {notice[u.id] && <div className="text-xs text-success" role="status">{notice[u.id]}</div>}
              </td>
              <td>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${u.active ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{u.active ? "Active" : "Inactive"}</span>
                {u.locked && <div className="text-xs text-danger">Locked (wrong passwords)</div>}
              </td>
              <td className="relative">
                <button className="btn btn-secondary px-2 py-1 text-sm" aria-haspopup="menu" aria-expanded={menu === u.id} onClick={() => setMenu(menu === u.id ? null : u.id)}>⋯</button>
                {menu === u.id && (
                  <div className="card absolute right-2 z-10 mt-1 w-56 p-1 shadow-lg" role="menu" onMouseLeave={() => setMenu(null)}>
                    <button role="menuitem" className="block w-full rounded px-3 py-2 text-left hover:bg-surface-2" disabled={busy}
                      onClick={() => start(async () => { await resetPassword(u.id); setNotice((s) => ({ ...s, [u.id]: "Reset. They must set a new one at sign-in." })); setMenu(null); })}>
                      Reset to starting password
                    </button>
                    <button role="menuitem" className={`block w-full rounded px-3 py-2 text-left hover:bg-surface-2 ${u.active ? "text-danger" : ""}`} disabled={busy}
                      onClick={() => start(async () => { await setUserActive(u.id, !u.active); setMenu(null); })}>
                      {u.active ? "Deactivate (cannot sign in)" : "Activate"}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
