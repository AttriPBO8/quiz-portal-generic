"use client";

import { useActionState, useState } from "react";
import { loginAdmin } from "@/app/actions/admin-auth";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, undefined);
  // Controlled, so the username stays filled in after a wrong password.
  const [username, setUsername] = useState("");
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="username">Username</label><input id="username" name="username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" autoComplete="current-password" required /></div>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
