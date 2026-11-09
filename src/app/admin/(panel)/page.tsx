import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ROLE_TYPES } from "@/lib/constants";
import { filterOptions, getResultRows, STATUS_LABEL, summarize, type ResultFilters } from "@/lib/reports";
import { FilterBar } from "@/components/FilterBar";
import { SortableTable } from "@/components/SortableTable";

export default async function Results({ searchParams }: { searchParams: Promise<ResultFilters> }) {
  const admin = await requireAdmin();
  const f = await searchParams;
  const [rows, opts] = await Promise.all([getResultRows(admin, f), filterOptions(admin)]);
  const sum = summarize(rows);
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  const cards = [
    { label: "Assigned", value: sum.assigned },
    { label: "Passed", value: sum.passed, tone: "text-success" },
    { label: "In progress", value: sum.inProgress },
    { label: "Not started", value: sum.notStarted },
    { label: "Blocked", value: sum.blocked, tone: "text-danger" },
    { label: "Pass rate", value: `${sum.passRate}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="text-muted">{admin.role === "SUPER_ADMIN" ? "Everyone" : "Your users"}, one row per person per quiz. Dummy accounts are hidden unless you filter for them.</p>
        </div>
        {sum.passed > 0 && <Link className="btn btn-secondary" href={`/admin/certificates?${query}`}>Certificates for passed ({sum.passed})</Link>}
        <a className="btn btn-secondary" href={`/admin/export/results?${query}`}>Download CSV</a>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <dt className="text-xs font-semibold uppercase text-muted">{c.label}</dt>
            <dd className={`mt-1 text-2xl font-bold tabular-nums ${c.tone ?? ""}`}>{c.value}</dd>
          </div>
        ))}
      </dl>

      <FilterBar
        search="Name or phone"
        filters={[
          { name: "quizId", label: "Quiz", options: opts.quizzes.map((q) => ({ value: q.id, label: q.title })) },
          { name: "districtId", label: "District", options: opts.districts.map((d) => ({ value: d.id, label: d.name })) },
          { name: "blockId", label: "Block", options: opts.blocks.filter((b) => !f.districtId || b.districtId === f.districtId).map((b) => ({ value: b.id, label: b.name })) },
          { name: "roleType", label: "Role", options: ROLE_TYPES.map((r) => ({ value: r.value, label: r.label })) },
          { name: "status", label: "Status", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
        ]}
      />

      <SortableTable
        defaultSort={["district", "block", "role", "name"]}
        empty="No results match these filters."
        columns={[
          { key: "district", label: "District" },
          { key: "block", label: "Block" },
          { key: "role", label: "Role" },
          { key: "name", label: "Name", linkKey: "href" },
          { key: "phone", label: "Phone" },
          ...(admin.role === "SUPER_ADMIN" ? [{ key: "localAdmin", label: "Local Admin" }] : []),
          { key: "quiz", label: "Quiz" },
          { key: "statusLabel", label: "Status", badge: true },
          { key: "best", label: "Best score", numeric: true },
          { key: "attempts", label: "Attempts", numeric: true },
          { key: "dueBy", label: "Due by" },
          { key: "completedOn", label: "Passed on" },
          { key: "certificate", label: "Certificate", linkKey: "certificateHref" },
        ]}
        rows={rows.map(({ lastAttemptId, passedAttemptId, ...r }) => ({
          ...r,
          href: lastAttemptId ? `/admin/attempts/${lastAttemptId}` : null,
          certificate: passedAttemptId ? "View" : "",
          certificateHref: passedAttemptId ? `/admin/certificates?attempt=${passedAttemptId}` : null,
        }))}
      />
    </div>
  );
}
