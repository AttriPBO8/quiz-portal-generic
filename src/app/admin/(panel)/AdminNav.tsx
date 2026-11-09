"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" || path.startsWith("/admin/attempts") : path.startsWith(href));
  return (
    <nav aria-label="Admin" className="lg:w-48 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={`block whitespace-nowrap rounded-lg px-3 py-2 font-medium ${active(l.href) ? "bg-primary-soft text-primary" : "hover:bg-surface-2"}`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
