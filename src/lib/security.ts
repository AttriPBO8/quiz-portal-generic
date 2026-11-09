import "server-only";
import { db } from "./db";
import { writeLog } from "./log";
import { requestInfo } from "./request-info";

// Security events go to the security log (file / CloudWatch) and to the SecurityEvent table,
// which the Super Admin can read and download under Admin > Security log.

export const SECURITY_EVENT_LABEL = {
  USER_LOGIN: "Quiz-taker sign-in",
  ADMIN_LOGIN: "Admin sign-in",
  LOGOUT: "Sign-out",
  ACCOUNT_LOCKED: "Account locked (wrong passwords)",
  PASSWORD_CHANGE: "Password changed",
  PASSWORD_RESET: "Password reset by an admin",
  ACCOUNT_STATUS: "Account activated or deactivated",
  ADMIN_CREATED: "Admin account created",
  USERS_UPLOADED: "Users uploaded",
  QUESTIONS_UPLOADED: "Questions uploaded",
  DATA_EXPORT: "Data downloaded",
  ACCESS_DENIED: "Access refused",
  SITE_DATES: "Quiz site dates changed",
} as const;
export type SecurityEventType = keyof typeof SECURITY_EVENT_LABEL;

const KEEP_DAYS = 365;

export async function securityEvent(e: {
  type: SecurityEventType;
  success: boolean;
  portal: "quiz" | "admin";
  account?: string;
  label?: string;
  detail?: string;
}) {
  const info = await requestInfo();
  writeLog("security", { ...e, actor: info.actor, ip: info.ip, userAgent: info.userAgent, requestId: info.requestId });
  try {
    await db.securityEvent.create({ data: { ...e, ip: info.ip, userAgent: info.userAgent } });
    // Now and then, clear out events older than a year so the table stays small.
    if (Math.random() < 0.002) {
      await db.securityEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
    }
  } catch (err) {
    writeLog("security", { type: "LOG_WRITE_FAILED", message: String(err).slice(0, 200) });
  }
}

/** Records who downloaded which file. Downloads hold personal data, so they are worth tracing. */
export function logExport(admin: { id: string; username: string }, file: string, rows: number) {
  return securityEvent({ type: "DATA_EXPORT", success: true, portal: "admin", account: `admin:${admin.id}`, label: admin.username, detail: `${file} (${rows} rows)` });
}

export type SecurityFilters = { type?: string; outcome?: string; portal?: string; days?: string; q?: string };
export const SECURITY_PERIODS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

/** Security events for the Super Admin's log screen and download, newest first. */
export async function getSecurityEvents(f: SecurityFilters, take = 1000) {
  const days = Number(f.days) || 365; // "All" = everything kept (one year)
  return db.securityEvent.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
      ...(f.type && f.type in SECURITY_EVENT_LABEL ? { type: f.type } : {}),
      ...(f.outcome ? { success: f.outcome === "success" } : {}),
      ...(f.portal === "quiz" || f.portal === "admin" ? { portal: f.portal } : {}),
      ...(f.q ? { OR: [{ label: { contains: f.q, mode: "insensitive" as const } }, { ip: { contains: f.q } }, { detail: { contains: f.q, mode: "insensitive" as const } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}
