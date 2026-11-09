"use client";

import { useMemo, useState, useTransition } from "react";
import { setQuestionActive } from "@/app/actions/admin-content";

type Row = { id: string; text: string; difficulty: string; category: string; active: boolean; correctAnswer: string; asked: number; correct: number; wrong: number; skipped: number; correctRate: number | null };
const COLS: { key: keyof Row; label: string; numeric?: boolean }[] = [
  { key: "id", label: "Id" }, { key: "difficulty", label: "Level" }, { key: "text", label: "Question" }, { key: "correctAnswer", label: "Correct answer" },
  { key: "asked", label: "Asked", numeric: true }, { key: "correct", label: "Correct", numeric: true }, { key: "wrong", label: "Wrong", numeric: true },
  { key: "skipped", label: "Skipped", numeric: true }, { key: "correctRate", label: "% correct", numeric: true },
];

export function QuestionTable({ bankId, rows }: { bankId: string; rows: Row[] }) {
  const [sort, setSort] = useState<{ key: keyof Row; dir: 1 | -1 }>({ key: "id", dir: 1 });
  const [busy, start] = useTransition();
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { numeric: true })) * sort.dir;
  }), [rows, sort]);

  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr>
          {COLS.map((c) => (
            <th key={c.key} className={c.numeric ? "text-right" : ""}>
              <button className="uppercase" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                {c.label} <span className="text-muted">{sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
              </button>
            </th>
          ))}
          <th>In use</th>
        </tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className={r.active ? "" : "opacity-60"}>
              {COLS.map((c) => <td key={c.key} className={c.numeric ? "text-right tabular-nums" : c.key === "text" ? "wrap" : ""}>{r[c.key] === null ? "" : String(r[c.key])}</td>)}
              <td><input type="checkbox" aria-label={`Use question ${r.id}`} checked={r.active} disabled={busy} className="h-5 w-5" onChange={(e) => start(() => setQuestionActive(bankId, r.id, e.target.checked))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
