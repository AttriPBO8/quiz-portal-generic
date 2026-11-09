"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const PAGE = 200;

// A table whose columns sort when their header is clicked. Default order is set by `defaultSort`.

export type Column = { key: string; label: string; numeric?: boolean; linkKey?: string; badge?: boolean; wrap?: boolean };
type Row = Record<string, string | number | null>;

const BADGE: Record<string, string> = {
  Passed: "bg-success-soft text-success",
  Correct: "bg-success-soft text-success",
  Active: "bg-success-soft text-success",
  Successful: "bg-success-soft text-success",
  Failed: "bg-danger-soft text-danger",
  Blocked: "bg-danger-soft text-danger",
  Wrong: "bg-danger-soft text-danger",
  Inactive: "bg-danger-soft text-danger",
  "In progress": "bg-warning-soft text-warning-text",
};

export function SortableTable({ columns, rows, defaultSort = [], empty = "Nothing to show." }: {
  columns: Column[];
  rows: Row[];
  defaultSort?: string[];
  empty?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const sorted = useMemo(() => {
    const keys = sort ? [sort.key, ...defaultSort] : defaultSort;
    const dir = (k: string) => (sort && k === sort.key ? sort.dir : 1);
    return [...rows].sort((a, b) => {
      for (const k of keys) {
        const x = a[k], y = b[k];
        if (x === y) continue;
        if (x === null || x === "") return 1;
        if (y === null || y === "") return -1;
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { numeric: true });
        if (c) return c * dir(k);
      }
      return 0;
    });
  }, [rows, sort, defaultSort]);

  if (!rows.length) return <p className="card px-4 py-8 text-center text-muted">{empty}</p>;
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => {
              const on = sort?.key === c.key;
              return (
                <th key={c.key} aria-sort={on ? (sort!.dir === 1 ? "ascending" : "descending") : undefined} className={c.numeric ? "text-right" : ""}>
                  <button className="inline-flex items-center gap-1 uppercase" onClick={() => setSort(on && sort!.dir === 1 ? { key: c.key, dir: -1 } : { key: c.key, dir: 1 })}>
                    {c.label}<span className="text-muted">{on ? (sort!.dir === 1 ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, limit).map((r, i) => (
            <tr key={i}>
              {columns.map((c) => {
                const v = r[c.key];
                const text = v === null || v === undefined ? "" : String(v);
                const href = c.linkKey ? r[c.linkKey] : null;
                return (
                  <td key={c.key} className={c.numeric ? "text-right tabular-nums" : c.wrap ? "wrap" : ""}>
                    {c.badge && text ? <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[text] ?? "bg-surface-2 text-muted"}`}>{text}</span>
                      : href ? <Link className="text-primary underline" href={String(href)}>{text}</Link> : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length > limit && (
        <div className="border-t border-border p-3 text-center">
          <button className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>Show more ({sorted.length - limit} left)</button>
        </div>
      )}
    </div>
  );
}
