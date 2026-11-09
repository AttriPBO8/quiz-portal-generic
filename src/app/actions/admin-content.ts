"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, dbForImports } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { importQuestions, type ImportReport } from "@/lib/importers";
import { generatePassword, hashPassword } from "@/lib/passwords";
import { securityEvent } from "@/lib/security";

// Super Admin actions: question banks and admin accounts.

export async function uploadQuestions(_: ImportReport | { error: string } | undefined, form: FormData): Promise<ImportReport | { error: string }> {
  const me = await requireSuperAdmin();
  const name = String(form.get("bankName") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: "Give the question bank a name (2 to 80 characters)." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a JSON file." };
  if (file.size > 5 * 1024 * 1024) return { error: "The file is larger than 5 MB." };
  let data: unknown;
  try { data = JSON.parse(await file.text()); } catch { return { error: "The file is not valid JSON." }; }
  const report = await importQuestions(dbForImports, name, data);
  await securityEvent({ type: "QUESTIONS_UPLOADED", success: true, portal: "admin", account: `admin:${me.id}`, label: me.username, detail: `${name}: ${report.created} created, ${report.updated} updated, ${report.errors.length} errors` });
  revalidatePath("/admin/questions");
  return report;
}

export async function setQuestionActive(bankId: string, externalId: string, active: boolean) {
  await requireSuperAdmin();
  await db.question.update({ where: { bankId_externalId: { bankId, externalId } }, data: { active } });
  revalidatePath(`/admin/questions/${bankId}`);
}

const newAdmin = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, "Username: 3 to 40 letters, numbers, dots, dashes or underscores."),
  name: z.string().trim().min(2, "Enter a name.").max(80),
  role: z.enum(["LOCAL_ADMIN", "SUPER_ADMIN"]),
});

export type AdminFormState = { error?: string; created?: { username: string; password: string } } | undefined;

export async function createAdmin(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const me = await requireSuperAdmin();
  const parsed = newAdmin.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await db.admin.findUnique({ where: { username: parsed.data.username } })) return { error: "That username is taken." };
  const password = generatePassword(12);
  const created = await db.admin.create({ data: { ...parsed.data, passwordHash: await hashPassword(password) } });
  await securityEvent({ type: "ADMIN_CREATED", success: true, portal: "admin", account: `admin:${created.id}`, label: created.username, detail: `${created.role === "SUPER_ADMIN" ? "Super Admin" : "Local Admin"} created by ${me.username}` });
  revalidatePath("/admin/admins");
  return { created: { username: parsed.data.username, password } };
}

export async function resetAdminPassword(adminId: string): Promise<string> {
  const me = await requireSuperAdmin();
  if (me.id === adminId) throw new Error("Use Change password for your own account.");
  const password = generatePassword(12);
  const target = await db.admin.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
  await securityEvent({ type: "PASSWORD_RESET", success: true, portal: "admin", account: `admin:${target.id}`, label: target.username, detail: `Reset by ${me.username}` });
  return password;
}

export async function setAdminActive(adminId: string, active: boolean) {
  const me = await requireSuperAdmin();
  if (me.id === adminId) return;
  const target = await db.admin.update({ where: { id: adminId }, data: { active, sessionVersion: { increment: 1 } } });
  await securityEvent({ type: "ACCOUNT_STATUS", success: true, portal: "admin", account: `admin:${target.id}`, label: target.username, detail: `${active ? "Activated" : "Deactivated"} by ${me.username}` });
  revalidatePath("/admin/admins");
}
