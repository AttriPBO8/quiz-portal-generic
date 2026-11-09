"use client";

import { useActionState } from "react";
import { createUser, updateUser, type UserFormState } from "@/app/actions/admin-users";
import { DEFAULT_ROLE, GROUP_LABEL } from "@/lib/constants";

export type UserFormValues = { id: string; name: string; email: string; phone: string; role: string; group: string; testAccount: boolean; localAdminId: string };

/**
 * Add user, or Edit user when `user` is given. Role and group are free text with suggestions
 * from what is already in use, so each customer can use their own words.
 */
export function UserForm({ user, roles, groups, localAdmins }: {
  user?: UserFormValues;
  roles: string[];
  groups: string[];
  localAdmins?: { id: string; name: string }[];
}) {
  const save = user ? updateUser.bind(null, user.id) : createUser;
  const [state, action, pending] = useActionState<UserFormState, FormData>(save, undefined);
  // After an error, keep what was typed (React clears a form after each submit).
  const v = state?.error ? state.values : undefined;
  const suggestedRoles = Array.from(new Set([DEFAULT_ROLE, ...roles]));

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className="label">Full name</span>
        <input className="input" name="name" defaultValue={v?.name ?? user?.name} required maxLength={100} autoComplete="off" />
      </label>
      <label><span className="label">Email</span>
        <input className="input" name="email" type="email" defaultValue={v?.email ?? user?.email} maxLength={254} autoComplete="off" placeholder="name@example.com" />
      </label>
      <label><span className="label">Phone</span>
        <input className="input" name="phone" type="tel" inputMode="tel" defaultValue={v?.phone ?? user?.phone} maxLength={20} autoComplete="off" placeholder="With country code if they use one" />
      </label>
      <p className="-mt-1 text-sm text-muted sm:col-span-2">Give an email, a phone number, or both. The user can sign in with either one.</p>
      <label><span className="label">Role (shown in reports)</span>
        <input className="input" name="role" list="role-options" defaultValue={v?.role ?? user?.role ?? ""} maxLength={40} placeholder={DEFAULT_ROLE} />
        <datalist id="role-options">{suggestedRoles.map((r) => <option key={r} value={r} />)}</datalist>
      </label>
      <label><span className="label">{GROUP_LABEL} (optional)</span>
        <input className="input" name="group" list="group-options" defaultValue={v?.group ?? user?.group ?? ""} maxLength={80} />
        <datalist id="group-options">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      </label>
      {localAdmins && (
        <label><span className="label">Local Admin</span>
          <select className="input" name="localAdminId" defaultValue={v?.localAdminId ?? user?.localAdminId ?? ""}>
            <option value="">(none)</option>
            {localAdmins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 self-end pb-2">
        <input type="checkbox" name="testAccount" defaultChecked={v ? !!v.testAccount : user?.testAccount} className="h-5 w-5" />
        <span>Test account (left out of reports)</span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : user ? "Save changes" : "Add user"}</button>
        {!user && <span className="text-sm text-muted">New users get the starting password and must choose their own when they first sign in.</span>}
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success sm:col-span-2">{state.ok}</p>}
    </form>
  );
}
