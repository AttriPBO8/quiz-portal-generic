import type { RoleType } from "@prisma/client";

export const APP_NAME = "Online Quiz Portal";
export const COPYRIGHT = "Attrilium Technology Inc.";

export const ROLE_TYPES: { value: RoleType; label: string }[] = [
  { value: "TEACHER", label: "Teacher" },
  { value: "WORKER", label: "Worker" },
  { value: "HELPER", label: "Helper" },
  { value: "DUMMY", label: "Dummy" },
];

export const roleLabel = (r: RoleType) => ROLE_TYPES.find((x) => x.value === r)?.label ?? r;

export const HONOR_CODE = [
  "I will answer every question on my own, without help from any person, book, phone or website.",
  "I will not share, copy, photograph or record the questions or answers.",
  "I understand that my attempt is timed and recorded against my name and device.",
  "I understand that dishonest attempts may be cancelled and reported.",
  "I agree to take this quiz honestly and to the best of my ability.",
];

/** Lock an account for this long after too many wrong passwords. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

/** Two failed attempts within this window block the quiz until the window passes. */
export const MAX_FAILED_ATTEMPTS = 2;
export const BLOCK_HOURS = 24;

/** All dates are shown and entered in India time. */
export const TIME_ZONE = "Asia/Kolkata";
export const TIME_ZONE_OFFSET = "+05:30";

export const formatDateTime = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatTime = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
export const formatDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }) : "");

/** Value for an <input type="datetime-local">, in India time. */
export const toLocalInput = (d: Date | null) =>
  d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "";
/** Reads an <input type="datetime-local"> value as India time. */
export const fromLocalInput = (v: string) => (v ? new Date(`${v}:00${TIME_ZONE_OFFSET}`) : null);
