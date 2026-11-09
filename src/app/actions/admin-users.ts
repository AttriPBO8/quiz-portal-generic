"use server";

import { revalidatePath } from "next/cache";
import { db, dbForImports } from "@/lib/db";
import { requireAdmin, requireSuperAdmin, userScope } from "@/lib/auth";
import { env } from "@/lib/env";
import { parseCsv } from "@/lib/csv";
import { importUsers, type ImportReport } from "@/lib/importers";
import { protectPassword } from "@/lib/passwords";
import { maskPhone } from "@/lib/log";
import { securityEvent } from "@/lib/security";

// Admin actions on quiz-takers. Each one re-checks that the user belongs to the admin.

async function ownedUser(userId: string) {
  const admin = await requireAdmin();
  const user = await db.user.findFirst({ where: { id: userId, ...userScope(admin) } });
  if (!user) {
    await securityEvent({ type: "ACCESS_DENIED", success: false, portal: "admin", account: `user:${userId}`, detail: `${admin.username} tried to change a user outside their list` });
    throw new Error("User not found.");
  }
  return { user, admin };
}

// Admins never see a user's password. A reset puts the user back on the starting password,
// and they must choose a new one at their next sign-in.
export async function resetPassword(userId: string) {
  const { user, admin } = await ownedUser(userId);
  const plain = env.defaultUserPassword;
  await db.user.update({
    where: { id: user.id },
    data: { ...(await protectPassword(plain)), passwordChangedAt: null, failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
  });
  await securityEvent({ type: "PASSWORD_RESET", success: true, portal: "admin", account: `user:${user.id}`, label: `${user.name} (${maskPhone(user.phone)})`, detail: `Reset to the starting password by ${admin.username}` });
  revalidatePath("/admin/users");
}

export async function setUserActive(userId: string, active: boolean) {
  const { user, admin } = await ownedUser(userId);
  await db.user.update({ where: { id: user.id }, data: { active, sessionVersion: { increment: 1 } } });
  await securityEvent({ type: "ACCOUNT_STATUS", success: true, portal: "admin", account: `user:${user.id}`, label: `${user.name} (${maskPhone(user.phone)})`, detail: `${active ? "Activated" : "Deactivated"} by ${admin.username}` });
  revalidatePath("/admin/users");
}

export async function uploadUsers(_: ImportReport | { error: string } | undefined, form: FormData): Promise<ImportReport | { error: string }> {
  const me = await requireSuperAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 5 * 1024 * 1024) return { error: "The file is larger than 5 MB. Split it into smaller files." };
  const rows = parseCsv(await file.text());
  if (!rows.length) return { error: "The file has no rows." };
  const missing = ["district", "block", "role_type", "phone", "name"].filter((c) => !(c in rows[0]));
  if (missing.length) return { error: `Missing column(s): ${missing.join(", ")}.` };
  const report = await importUsers(dbForImports, rows, env.defaultUserPassword);
  await securityEvent({ type: "USERS_UPLOADED", success: true, portal: "admin", account: `admin:${me.id}`, label: me.username, detail: `${file.name}: ${report.created} created, ${report.updated} updated, ${report.errors.length} errors` });
  revalidatePath("/admin/users");
  return report;
}
