"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { formatDateTime, fromLocalInput } from "@/lib/constants";
import { securityEvent } from "@/lib/security";

export type SiteFormState = { error?: string; ok?: string } | undefined;

export async function saveQuizSiteDates(_: SiteFormState, form: FormData): Promise<SiteFormState> {
  const me = await requireSuperAdmin();
  const clear = form.get("clear") === "1";
  const opensAt = clear ? null : fromLocalInput(String(form.get("opensAt") ?? ""));
  const closesAt = clear ? null : fromLocalInput(String(form.get("closesAt") ?? ""));
  if (opensAt && closesAt && closesAt <= opensAt) return { error: "The closing time must be after the opening time." };
  const data = { quizSiteOpensAt: opensAt, quizSiteClosesAt: closesAt, updatedBy: me.username };
  await db.siteSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  const summary = `${opensAt ? `opens ${formatDateTime(opensAt)}` : "no opening date"}, ${closesAt ? `closes ${formatDateTime(closesAt)}` : "no closing date"}`;
  await securityEvent({ type: "SITE_DATES", success: true, portal: "admin", account: `admin:${me.id}`, label: me.username, detail: `Quiz site ${summary}` });
  revalidatePath("/admin/site");
  return { ok: clear ? "Cleared. The quiz site is open all the time." : "Saved." };
}
