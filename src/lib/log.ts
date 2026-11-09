import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Structured logs, one JSON object per line, kept in separate channels:
//   quiz-access   every request to the quiz-taker site
//   admin-access  every request to the admin site
//   security      sign-ins (both outcomes), lockouts, password changes, blocked requests
//   db-changes    every insert, update and delete in the database
//
// Each line always goes to the server output. On AWS Amplify that is CloudWatch Logs, where the
// `channel` field separates them. When LOG_DIR is set (it is by default on a laptop), each channel
// is also written to its own daily file, for example logs/security-2026-10-29.log.
// Never pass passwords, password hashes or session tokens to these functions.

export type LogChannel = "quiz-access" | "admin-access" | "security" | "db-changes";

const logDir = process.env.LOG_DIR ?? (process.env.NODE_ENV === "production" ? "" : "logs");
let dirReady: Promise<unknown> | null = null;

const SECRET_KEY = /hash|secret|token|cookie|authorization|^password$/i;

/** Copies an object for logging, replacing anything that looks like a secret. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth > 4) return "[…]";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.length > 50 ? `[${value.length} items]` : value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [
    k,
    SECRET_KEY.test(k) ? "[hidden]" : k === "phone" && typeof v === "string" ? maskPhone(v) : redact(v, depth + 1),
  ]));
}

/** Shows only the last 4 digits of a phone number, enough to tell people apart in a log. */
export const maskPhone = (phone: string) => (phone.length > 4 ? `${"*".repeat(phone.length - 4)}${phone.slice(-4)}` : "****");

export function writeLog(channel: LogChannel, entry: Record<string, unknown>) {
  const time = new Date();
  const line = JSON.stringify({ time: time.toISOString(), channel, ...(redact(entry) as object) });
  console.log(line);
  if (!logDir) return;
  const file = path.join(logDir, `${channel}-${time.toISOString().slice(0, 10)}.log`);
  dirReady ??= mkdir(logDir, { recursive: true }).catch(() => undefined);
  // Logging must never break a request, so file errors are ignored.
  void dirReady.then(() => appendFile(file, line + "\n")).catch(() => undefined);
}
