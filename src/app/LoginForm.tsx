"use client";

import { useActionState, useState } from "react";
import { loginUser } from "./actions/user-auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginUser, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="login" className="label">Email or phone number</label>
        <input
          id="login" name="login" className="input" autoComplete="username" autoCapitalize="none" autoCorrect="off"
          spellCheck={false} maxLength={254} placeholder="you@example.com or 4165550101" required autoFocus
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} className="input pr-16" autoComplete="current-password" maxLength={64} required />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-sm font-semibold text-primary" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
