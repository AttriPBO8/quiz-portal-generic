import { getCurrentAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/constants";
import { csvResponse, toCsv } from "@/lib/csv";
import { getSecurityEvents, logExport, SECURITY_EVENT_LABEL } from "@/lib/security";

export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "SUPER_ADMIN") return new Response("Not allowed", { status: 403 });
  const events = await getSecurityEvents(Object.fromEntries(new URL(req.url).searchParams), 100_000);
  const body = events.map((e) => [
    formatDateTime(e.createdAt), SECURITY_EVENT_LABEL[e.type as keyof typeof SECURITY_EVENT_LABEL] ?? e.type, e.success ? "Successful" : "Failed",
    e.portal, e.label ?? "", e.account ?? "", e.detail ?? "", e.ip ?? "", e.userAgent ?? "",
  ]);
  const file = `security-log-${new Date().toISOString().slice(0, 10)}.csv`;
  await logExport(admin, file, body.length);
  return csvResponse(file, toCsv(["Time", "Event", "Outcome", "Site", "Account", "Account id", "Detail", "Address", "Browser"], body));
}
