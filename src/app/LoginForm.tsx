"use client";

import { useActionState, useState } from "react";
import { Combobox } from "@/components/Combobox";
import { ROLE_TYPES } from "@/lib/constants";
import { loginUser } from "./actions/user-auth";

type District = { id: string; name: string; blocks: { id: string; name: string }[] };

export function LoginForm({ districts }: { districts: District[] }) {
  const [state, action, pending] = useActionState(loginUser, undefined);
  const [districtId, setDistrictId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [roleType, setRoleType] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const blocks = districts.find((d) => d.id === districtId)?.blocks ?? [];

  return (
    <form action={action} className="space-y-4">
      <Combobox
        label="District" name="districtId" value={districtId}
        options={districts.map((d) => ({ value: d.id, label: d.name }))}
        onChange={(v) => { setDistrictId(v); setBlockId(""); }}
        placeholder="Type to search districts"
      />
      <Combobox
        label="Block" name="blockId" value={blockId} disabled={!districtId}
        options={blocks.map((b) => ({ value: b.id, label: b.name }))}
        onChange={setBlockId}
        placeholder={districtId ? "Type to search blocks" : "Choose a district first"}
      />
      <Combobox
        label="Role" name="roleType" value={roleType}
        options={ROLE_TYPES.map((r) => ({ value: r.value, label: r.label }))}
        onChange={setRoleType}
        placeholder="Teacher, Worker, Helper…"
      />
      <div>
        <label htmlFor="phone" className="label">Phone number</label>
        <input id="phone" name="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="\d{10}" placeholder="10-digit mobile number" required />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} className="input pr-16" autoComplete="current-password" required />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-sm font-semibold text-primary">
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
