import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { readSession } from "./session";
import { securityEvent } from "./security";

// Helpers that load the signed-in account for a page or action.
// Every protected page and server action calls one of these first.

export const getCurrentUser = cache(async () => {
  const s = await readSession("user");
  if (!s) return null;
  const user = await db.user.findUnique({
    where: { id: s.sub },
    include: { district: true, block: true },
  });
  if (!user || !user.active || user.sessionVersion !== s.ver) return null;
  return user;
});

export const getCurrentAdmin = cache(async () => {
  const s = await readSession("admin");
  if (!s) return null;
  const admin = await db.admin.findUnique({ where: { id: s.sub } });
  if (!admin || !admin.active || admin.sessionVersion !== s.ver) return null;
  return admin;
});

/** Lighter check for frequent calls (saving answers): returns the user id or null. */
export async function currentUserId(): Promise<string | null> {
  const s = await readSession("user");
  if (!s) return null;
  const u = await db.user.findUnique({ where: { id: s.sub }, select: { active: true, sessionVersion: true } });
  return u && u.active && u.sessionVersion === s.ver ? s.sub : null;
}

/**
 * The signed-in quiz-taker. Anyone still on the starting password (new, or reset by an admin)
 * is sent to set their own before they can do anything else.
 */
export async function requireUser({ allowStartingPassword = false } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!user.passwordChangedAt && !allowStartingPassword) redirect("/account/password");
  return user;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requireSuperAdmin() {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") {
    await securityEvent({ type: "ACCESS_DENIED", success: false, portal: "admin", account: `admin:${admin.id}`, label: admin.username, detail: "Tried to open a Super Admin page or action" });
    redirect("/admin");
  }
  return admin;
}

/** Database filter limiting users to those a given admin may see. */
export function userScope(admin: { id: string; role: string }) {
  return admin.role === "SUPER_ADMIN" ? {} : { localAdminId: admin.id };
}

/** Database filter limiting quizzes to those a given admin may manage. */
export function quizScope(admin: { id: string; role: string }) {
  return admin.role === "SUPER_ADMIN" ? {} : { managers: { some: { adminId: admin.id } } };
}
