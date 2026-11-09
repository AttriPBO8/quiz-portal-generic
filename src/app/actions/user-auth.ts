"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatTime, LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILURES } from "@/lib/constants";
import { checkPasswordStrength, protectPassword, verifyPassword } from "@/lib/passwords";
import { maskPhone } from "@/lib/log";
import { securityEvent } from "@/lib/security";
import { getQuizSite } from "@/lib/site";
import { clearSession, createSession, readSession } from "@/lib/session";

export type FormState = { error?: string; ok?: string } | undefined;

// A real bcrypt hash of a random string. Checking against it when no account matches keeps
// the response time the same, so timing does not reveal which phone numbers exist.
const DUMMY_HASH = "$2b$10$IHuKHVv0G5npWUjC9TZsH.2xrvSJSnb.hgPC0xRi0OYeLlR3igphq";

const loginSchema = z.object({
  districtId: z.string().min(1, "Choose your district."),
  blockId: z.string().min(1, "Choose your block."),
  roleType: z.enum(["TEACHER", "WORKER", "HELPER", "DUMMY"], { message: "Choose your role." }),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter your 10-digit phone number."),
  password: z.string().min(1, "Enter your password.").max(64),
});

export async function loginUser(_: FormState, form: FormData): Promise<FormState> {
  const site = await getQuizSite();
  if (!site.open) {
    await securityEvent({ type: "USER_LOGIN", success: false, portal: "quiz", detail: "Quiz site is closed" });
    return { error: site.message! };
  }
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, ...key } = parsed.data;

  const user = await db.user.findUnique({ where: { districtId_blockId_roleType_phone: key } });
  const generic = "These details don't match our records. Check each field and try again.";
  const label = `${user?.name ?? "unknown"} (${maskPhone(key.phone)})`;
  const event = (success: boolean, detail: string, type: "USER_LOGIN" | "ACCOUNT_LOCKED" = "USER_LOGIN") =>
    securityEvent({ type, success, portal: "quiz", account: user ? `user:${user.id}` : undefined, label, detail });
  if (!user || !user.active) {
    await verifyPassword(password, DUMMY_HASH);
    await event(false, user ? "Account is deactivated" : "No account with these details");
    return { error: generic };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await event(false, "Account is locked");
    return { error: `Too many wrong passwords. Try again after ${formatTime(user.lockedUntil)}, or ask your admin to reset it.` };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failures = user.failedLogins + 1;
    const lock = failures >= LOGIN_MAX_FAILURES;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: lock ? 0 : failures, lockedUntil: lock ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) : null },
    });
    await event(false, `Wrong password (${failures} in a row)`);
    if (lock) await event(false, `Locked for ${LOGIN_LOCK_MINUTES} minutes`, "ACCOUNT_LOCKED");
    return { error: lock ? `Too many wrong passwords. Your account is locked for ${LOGIN_LOCK_MINUTES} minutes.` : generic };
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await event(true, user.passwordChangedAt ? "Signed in" : "Signed in with the starting password");
  await createSession({ sub: user.id, kind: "user", ver: user.sessionVersion });
  redirect(user.passwordChangedAt ? "/quizzes" : "/account/password");
}

export async function logoutUser() {
  const s = await readSession("user");
  if (s) await securityEvent({ type: "LOGOUT", success: true, portal: "quiz", account: `user:${s.sub}` });
  await clearSession("user");
  redirect("/");
}

export async function changeUserPassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ allowStartingPassword: true });
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const event = (success: boolean, detail: string) =>
    securityEvent({ type: "PASSWORD_CHANGE", success, portal: "quiz", account: `user:${user.id}`, label: `${user.name} (${maskPhone(user.phone)})`, detail });
  if (!(await verifyPassword(current, user.passwordHash))) {
    await event(false, "Current password was wrong");
    return { error: "Your current password is not right." };
  }
  const weak = checkPasswordStrength(next);
  if (weak) return { error: weak };
  if (next !== confirm) return { error: "The new passwords don't match." };
  if (next === current) return { error: "Choose a password different from the current one." };

  const updated = await db.user.update({
    where: { id: user.id },
    data: { ...(await protectPassword(next)), passwordChangedAt: new Date(), sessionVersion: { increment: 1 } },
  });
  await event(true, user.passwordChangedAt ? "Changed" : "Set at first sign-in");
  // Changing the password signs out other devices; keep this one signed in.
  await createSession({ sub: user.id, kind: "user", ver: updated.sessionVersion });
  if (!user.passwordChangedAt) redirect("/quizzes");
  return { ok: "Password changed." };
}
