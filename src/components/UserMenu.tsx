"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// The signed-in person's initials, opening a small menu with their details and Sign out.

export function UserMenu({ name, detail, initials, links = [], onSignOut }: {
  name: string;
  detail?: string;
  initials: string;
  links?: { href: string; label: string }[];
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
      >
        {initials}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-64 p-2 shadow-lg">
          <div className="px-3 py-2">
            <div className="font-semibold">{name}</div>
            {detail && <div className="text-sm text-muted">{detail}</div>}
          </div>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-md px-3 py-2 hover:bg-surface-2" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          <form action={onSignOut}>
            <button className="w-full rounded-md px-3 py-2 text-left text-danger hover:bg-surface-2">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
