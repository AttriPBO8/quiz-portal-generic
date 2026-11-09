"use client";

import { useEffect, useState } from "react";

// Color scheme dots and a light/dark toggle. The choice is remembered on this device.

const SCHEMES = [
  { id: "blue", label: "Blue", color: "#1d4ed8" },
  { id: "teal", label: "Teal", color: "#0f766e" },
  { id: "purple", label: "Purple", color: "#6d28d9" },
];

function save(mode: string, scheme: string) {
  document.documentElement.dataset.mode = mode;
  document.documentElement.dataset.scheme = scheme;
  try { localStorage.setItem("qp_theme", JSON.stringify({ mode, scheme })); } catch {}
}

export function ThemeControls() {
  const [mode, setMode] = useState("light");
  const [scheme, setScheme] = useState("blue");

  useEffect(() => {
    setMode(document.documentElement.dataset.mode || "light");
    setScheme(document.documentElement.dataset.scheme || "blue");
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5" role="radiogroup" aria-label="Color scheme">
        {SCHEMES.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={scheme === s.id}
            aria-label={`${s.label} color scheme`}
            title={s.label}
            onClick={() => { setScheme(s.id); save(mode, s.id); }}
            className={`h-5 w-5 rounded-full border-2 ${scheme === s.id ? "border-text" : "border-transparent"}`}
            style={{ background: s.color }}
          />
        ))}
      </div>
      <button
        onClick={() => { const m = mode === "dark" ? "light" : "dark"; setMode(m); save(m, scheme); }}
        className="h-9 w-9 rounded-lg border border-border bg-surface-2 grid place-items-center"
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={mode === "dark" ? "Light mode" : "Dark mode"}
      >
        {mode === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        )}
      </button>
    </div>
  );
}
