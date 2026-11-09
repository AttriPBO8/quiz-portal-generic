"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Filter drop-downs that update the page address, so a filtered view can be bookmarked or downloaded.

export type Filter = { name: string; label: string; options: { value: string; label: string }[] };

export function FilterBar({ filters, search, children }: { filters: Filter[]; search?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    if (name === "districtId") next.delete("blockId");
    router.replace(`${path}?${next}`);
  };
  return (
    <div className="card flex flex-wrap items-end gap-3 p-3">
      {filters.map((f) => (
        <label key={f.name} className="min-w-36 flex-1 sm:flex-none">
          <span className="label">{f.label}</span>
          <select className="input" value={params.get(f.name) ?? ""} onChange={(e) => set(f.name, e.target.value)}>
            <option value="">All</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      {search && (
        <form className="min-w-48 flex-1" onSubmit={(e) => { e.preventDefault(); set("q", String(new FormData(e.currentTarget).get("q") ?? "").trim()); }}>
          <label><span className="label">Search</span><input name="q" className="input" defaultValue={params.get("q") ?? ""} placeholder={search} /></label>
        </form>
      )}
      {children}
    </div>
  );
}
