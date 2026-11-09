"use server";

import { revalidatePath } from "next/cache";
import { db, dbForImports } from "@/lib/db";
import { requireAdmin, requireSuperAdmin, userScope } from "@/lib/auth";
import { env } from "@/lib/env";
import { parseCsv } from "@/lib/csv";
import { importUsers, userFields, type ImportReport } from "@/lib/importers";
import { protectPassword } from "@/lib/passwords";
import { userLabel } from "@/lib/contact";
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
  await securityEvent({ type: "PASSWORD_RESET", success: true, portal: "admin", account: `user:${user.id}`, label: userLabel(user), detail: `Reset to the starting password by ${admin.username}` });
  revalidatePath("/admin/users");
}

export async function setUserActive(userId: string, active: boolean) {
  const { user, admin } = await ownedUser(userId);
  await db.user.update({ where: { id: user.id }, data: { active, sessionVersion: { increment: 1 } } });
  await securityEvent({ type: "ACCOUNT_STATUS", success: true, portal: "admin", account: `user:${user.id}`, label: userLabel(user), detail: `${active ? "Activated" : "Deactivated"} by ${admin.username}` });
  revalidatePath("/admin/users");
}

export async function uploadUsers(_: ImportReport | { error: string } | undefined, form: FormData): Promise<ImportReport | { error: string }> {
  const me = await requireSuperAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 5 * 1024 * 1024) return { error: "The file is larger than 5 MB. Split it into smaller files." };
  const rows = parseCsv(await file.text());
  if (!rows.length) return { error: "The file has no rows." };
  if (!("name" in rows[0])) return { error: "Missing column: name." };
  if (!("email" in rows[0]) && !("phone" in rows[0])) return { error: "The file needs an email column, a phone column, or both." };
  const report = await importUsers(dbForImports, rows, env.defaultUserPassword);
  await securityEvent({ type: "USERS_UPLOADED", success: true, portal: "admin", account: `admin:${me.id}`, label: me.username, detail: `${file.name}: ${report.created} created, ${report.updated} updated, ${report.errors.length} errors` });
  revalidatePath("/admin/users");
  return report;
}

export type UserFormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

/** What the admin typed, sent back with an error so the form keeps it. */
const typed = (form: FormData) => Object.fromEntries(["name", "email", "phone", "role", "group", "localAdminId", "testAccount"].map((k) => [k, String(form.get(k) ?? "")]));

/** Fields from the Add user / Edit user form. */
function readUserForm(form: FormData) {
  return userFields.safeParse({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    role: String(form.get("role") ?? ""),
    group: String(form.get("group") ?? ""),
    test_account: form.get("testAccount") ? "yes" : "",
  });
}

/** Another user already has this email or phone? Returns a message, or null. */
async function contactTaken(u: { email: string; phone: string }, exceptId?: string) {
  const other = await db.user.findFirst({
    where: { id: exceptId ? { not: exceptId } : undefined, OR: [...(u.email ? [{ email: u.email }] : []), ...(u.phone ? [{ phone: u.phone }] : [])] },
    select: { email: true },
  });
  if (!other) return null;
  return other.email && other.email === u.email ? "Another user already has this email address." : "Another user already has this phone number.";
}

/**
 * Adds one quiz-taker. They get the starting password and must choose their own at first sign-in.
 * A Local Admin's new users are theirs; a Super Admin may pick the Local Admin.
 */
export async function createUser(_: UserFormState, form: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const parsed = readUserForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const u = parsed.data;
  const taken = await contactTaken(u);
  if (taken) return { error: taken, values: typed(form) };
  let localAdminId: string | null = admin.role === "LOCAL_ADMIN" ? admin.id : null;
  const picked = String(form.get("localAdminId") ?? "");
  if (admin.role === "SUPER_ADMIN" && picked) {
    localAdminId = (await db.admin.findFirst({ where: { id: picked, role: "LOCAL_ADMIN" } }))?.id ?? null;
  }
  const created = await db.user.create({
    data: {
      name: u.name, email: u.email || null, phone: u.phone || null, role: u.role, group: u.group, testAccount: u.test_account,
      localAdminId, ...(await protectPassword(env.defaultUserPassword)),
    },
  });
  await securityEvent({ type: "USER_CREATED", success: true, portal: "admin", account: `user:${created.id}`, label: userLabel(created), detail: `Added by ${admin.username}` });
  revalidatePath("/admin/users");
  return { ok: `Added ${created.name}. They sign in with ${[created.email, created.phone].filter(Boolean).join(" or ")} and the starting password.` };
}

/** Changes a quiz-taker's details. Changing the email or phone signs them out everywhere. */
export async function updateUser(userId: string, _: UserFormState, form: FormData): Promise<UserFormState> {
  const { user, admin } = await ownedUser(userId);
  const parsed = readUserForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: typed(form) };
  const u = parsed.data;
  const taken = await contactTaken(u, user.id);
  if (taken) return { error: taken, values: typed(form) };
  const email = u.email || null;
  const phone = u.phone || null;
  const contactChanged = email !== user.email || phone !== user.phone;
  let localAdminId = user.localAdminId;
  if (admin.role === "SUPER_ADMIN" && form.has("localAdminId")) {
    const picked = String(form.get("localAdminId") ?? "");
    localAdminId = picked ? (await db.admin.findFirst({ where: { id: picked, role: "LOCAL_ADMIN" } }))?.id ?? null : null;
  }
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      name: u.name, email, phone, role: u.role, group: u.group, testAccount: u.test_account, localAdminId,
      ...(contactChanged ? { sessionVersion: { increment: 1 } } : {}),
    },
  });
  await securityEvent({
    type: "USER_UPDATED", success: true, portal: "admin", account: `user:${user.id}`, label: userLabel(updated),
    detail: `Changed by ${admin.username}${contactChanged ? " (sign-in email or phone changed)" : ""}`,
  });
  revalidatePath("/admin/users");
  return { ok: "Saved." };
}
