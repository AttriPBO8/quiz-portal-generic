import { requireSuperAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/constants";
import { getSecurityEvents, SECURITY_EVENT_LABEL, SECURITY_PERIODS, type SecurityFilters } from "@/lib/security";
import { FilterBar } from "@/components/FilterBar";
import { SortableTable } from "@/components/SortableTable";

const SHOWN = 1000;

export default async function SecurityLog({ searchParams }: { searchParams: Promise<SecurityFilters> }) {
  await requireSuperAdmin();
  const f = await searchParams;
  const events = await getSecurityEvents(f, SHOWN);
  const failed = events.filter((e) => !e.success).length;
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Security log</h1>
          <p className="text-muted">
            Sign-ins (successful and failed), lockouts, password changes and resets, account changes, downloads and refused access.
            {" "}{events.length === SHOWN ? `Showing the newest ${SHOWN}; download for all.` : `${events.length} event${events.length === 1 ? "" : "s"}`}, {failed} failed. Kept for one year.
          </p>
        </div>
        <a className="btn btn-secondary" href={`/admin/export/security?${query}`}>Download CSV</a>
      </div>
      <FilterBar
        search="Name, username, address or detail"
        filters={[
          { name: "days", label: "Period", options: SECURITY_PERIODS },
          { name: "type", label: "Event", options: Object.entries(SECURITY_EVENT_LABEL).map(([value, label]) => ({ value, label })) },
          { name: "outcome", label: "Outcome", options: [{ value: "success", label: "Successful" }, { value: "failed", label: "Failed" }] },
          { name: "portal", label: "Site", options: [{ value: "quiz", label: "Quiz site" }, { value: "admin", label: "Admin site" }] },
        ]}
      />
      <SortableTable
        empty="No security events match these filters."
        columns={[
          { key: "time", label: "Time" },
          { key: "event", label: "Event" },
          { key: "outcome", label: "Outcome", badge: true },
          { key: "site", label: "Site" },
          { key: "who", label: "Account" },
          { key: "detail", label: "Detail", wrap: true },
          { key: "ip", label: "Address" },
        ]}
        rows={events.map((e) => ({
          time: formatDateTime(e.createdAt),
          event: SECURITY_EVENT_LABEL[e.type as keyof typeof SECURITY_EVENT_LABEL] ?? e.type,
          outcome: e.success ? "Successful" : "Failed",
          site: e.portal === "admin" ? "Admin" : "Quiz",
          who: e.label ?? e.account ?? "",
          detail: e.detail ?? "",
          ip: e.ip ?? "",
        }))}
      />
    </div>
  );
}
