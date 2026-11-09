import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { ThemeControls } from "./ThemeControls";

// Top bar on every screen: logo space on the left, theme controls and account on the right.

export function Logo() {
  // Placeholder mark. Replace public/logo.svg (and this component) with the real logo later.
  return (
    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-on-primary" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
    </span>
  );
}

export function AppHeader({ home = "/", title, right }: { home?: string; title?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href={home} className="flex min-w-0 items-center gap-2.5 font-bold">
          <Logo />
          <span className="truncate">{title ?? APP_NAME}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeControls />
          {right}
        </div>
      </div>
    </header>
  );
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
