import { requireSuperAdmin } from "@/lib/auth";
import { formatDateTime, toLocalInput } from "@/lib/constants";
import { getQuizSite } from "@/lib/site";
import { SiteDatesForm } from "./SiteDatesForm";

export default async function QuizSite() {
  await requireSuperAdmin();
  const site = await getQuizSite();
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quiz site</h1>
        <p className="text-muted">
          Open the quiz site only for the quiz cycle. Outside these dates quiz-takers see a closed page and cannot sign in or start a quiz;
          anyone already in a quiz can finish it. The admin site, results and certificates stay available. Leave a date empty for no limit.
        </p>
      </div>
      <p className={`rounded-lg px-3 py-2 font-semibold ${site.open ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`} role="status">
        {site.open ? "Open now" : "Closed now"}
        {site.open && site.closesAt ? `, closes ${formatDateTime(site.closesAt)}` : ""}
        {!site.open && site.message ? `. ${site.message}` : ""}
      </p>
      <SiteDatesForm opensAt={toLocalInput(site.opensAt)} closesAt={toLocalInput(site.closesAt)} />
      {site.updatedAt && <p className="text-sm text-muted">Last changed {formatDateTime(site.updatedAt)}{site.updatedBy ? ` by ${site.updatedBy}` : ""}.</p>}
    </div>
  );
}
