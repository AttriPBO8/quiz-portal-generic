"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILURES } from "@/lib/constants";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/passwords";
import { securityEvent } from "@/lib/security";
import { clearSession, createSession, readSession } from "@/lib/session";
import type { FormState } from "./user-auth";

const DUMMY_HASH = "$2b$10$IHuKHVv0G5npWUjC9TZsH.2xrvSJSnb.hgPC0xRi0OYeLlR3igphq";

const schema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter your username.").max(50),
  password: z.string().min(1, "Enter your password.").max(64),
});

export async function loginAdmin(_: FormState, form: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, password } = parsed.data;
  const admin = await db.admin.findUnique({ where: { username } });
  const generic = "Wrong username or password.";
  const event = (success: boolean, detail: string, type: "ADMIN_LOGIN" | "ACCOUNT_LOCKED" = "ADMIN_LOGIN") =>
    securityEvent({ type, success, portal: "admin", account: admin ? `admin:${admin.id}` : undefined, label: username, detail });
  if (!admin || !admin.active) {
    await verifyPassword(password, DUMMY_HASH);
    await event(false, admin ? "Account is deactivated" : "No such username");
    return { error: generic };
  }
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    await event(false, "Account is locked");
    return { error: `Too many wrong passwords. Try again after ${LOGIN_LOCK_MINUTES} minutes.` };
  }
  if (!(await verifyPassword(password, admin.passwordHash))) {
    const failures = admin.failedLogins + 1;
    const lock = failures >= LOGIN_MAX_FAILURES;
    await db.admin.update({
      where: { id: admin.id },
      data: { failedLogins: lock ? 0 : failures, lockedUntil: lock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) : null },
    });
    await event(false, `Wrong password (${failures} in a row)`);
    if (lock) await event(false, `Locked for ${LOGIN_LOCK_MINUTES} minutes`, "ACCOUNT_LOCKED");
    return { error: lock ? `Too many wrong passwords. Locked for ${LOGIN_LOCK_MINUTES} minutes.` : generic };
  }
  await db.admin.update({ where: { id: admin.id }, data: { failedLogins: 0, lockedUntil: null } });
  await event(true, `Signed in as ${admin.role === "SUPER_ADMIN" ? "Super Admin" : "Local Admin"}`);
  await createSession({ sub: admin.id, kind: "admin", ver: admin.sessionVersion });
  redirect("/admin");
}

export async function logoutAdmin() {
  const s = await readSession("admin");
  if (s) await securityEvent({ type: "LOGOUT", success: true, portal: "admin", account: `admin:${s.sub}` });
  await clearSession("admin");
  redirect("/admin/login");
}

export async function changeAdminPassword(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const event = (success: boolean, detail: string) =>
    securityEvent({ type: "PASSWORD_CHANGE", success, portal: "admin", account: `admin:${admin.id}`, label: admin.username, detail });
  if (!(await verifyPassword(current, admin.passwordHash))) {
    await event(false, "Current password was wrong");
    return { error: "Your current password is not right." };
  }
  const weak = checkPasswordStrength(next);
  if (weak) return { error: weak };
  if (next !== String(form.get("confirm") ?? "")) return { error: "The new passwords don't match." };
  const updated = await db.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  await event(true, "Changed");
  await createSession({ sub: admin.id, kind: "admin", ver: updated.sessionVersion });
  return { ok: "Password changed." };
}
