"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// A dropdown you can type into to filter the list. Works with keyboard and touch.

export type Option = { value: string; label: string };

export function Combobox({
  label, options, value, onChange, placeholder = "Search…", disabled, name,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}) {
  const id = useId();
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(selected?.label ?? ""), [selected?.label]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === selected?.label.toLowerCase()) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, selected?.label]);

  const pick = (o: Option) => { onChange(o.value); setQuery(o.label); setOpen(false); };

  return (
    <div ref={wrap} className="relative">
      <label htmlFor={id} className="label">{label}</label>
      {name && <input type="hidden" name={name} value={value} />}
      <input
        id={id}
        className="input pr-9"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={query}
        onFocus={(e) => { e.target.select(); setOpen(true); setActive(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); if (value) onChange(""); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open && filtered[active]) { e.preventDefault(); pick(filtered[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      <svg className="pointer-events-none absolute right-3 top-[2.6rem] text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      {open && !disabled && (
        <ul id={`${id}-list`} role="listbox" className="card absolute z-20 mt-1 max-h-60 w-full overflow-auto py-1 shadow-lg">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-primary-soft" : ""} ${o.value === value ? "font-semibold" : ""}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
