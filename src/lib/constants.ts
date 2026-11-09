// Per-customer settings. Each customer's deployment sets these as environment variables
// (Amplify > Hosting > Environment variables), then redeploys. See docs/SAAS.md.
// NEXT_PUBLIC_ values are built into the pages, so a change needs a new build.

/** Name shown in the header and browser tab, for example "Acme Training Portal". */
export const APP_NAME = process.env.NEXT_PUBLIC_PORTAL_NAME || "Quiz Portal";
/** The vendor, shown in the footer. */
export const COPYRIGHT = "Attrilium Technology Inc.";
/** What this customer calls a user's group: "Team", "Department", "Location", "Class"… */
export const GROUP_LABEL = process.env.NEXT_PUBLIC_GROUP_LABEL || "Group";
/** Role given to a new user when the admin leaves it empty. */
export const DEFAULT_ROLE = "Learner";

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

/**
 * Every date is shown and entered in this time zone (an IANA name such as "America/Toronto",
 * "Asia/Kolkata" or "Europe/London"). Daylight saving time is handled.
 */
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Toronto";
const LOCALE = process.env.NEXT_PUBLIC_LOCALE || "en-CA";

/** A short name for the time zone, for form labels, e.g. "Toronto time". */
export const TIME_ZONE_LABEL = `${TIME_ZONE.split("/").pop()!.replace(/_/g, " ")} time`;

export const formatDateTime = (d: Date) =>
  d.toLocaleString(LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatTime = (d: Date) => d.toLocaleTimeString(LOCALE, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
export const formatDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }) : "");
export const formatLongDate = (d: Date) => d.toLocaleDateString(LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });

/** Minutes the time zone is ahead of UTC at a given moment (negative west of UTC). */
export function zoneOffsetMinutes(at: Date, timeZone = TIME_ZONE) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

/** Value for an <input type="datetime-local">, in the portal's time zone. */
export const toLocalInput = (d: Date | null, timeZone = TIME_ZONE) =>
  d ? new Date(d.getTime() + zoneOffsetMinutes(d, timeZone) * 60_000).toISOString().slice(0, 16) : "";

/** Reads an <input type="datetime-local"> value as a time in the portal's time zone. */
export function fromLocalInput(v: string, timeZone = TIME_ZONE): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const asUtc = new Date(`${v}:00Z`).getTime();
  // Guess with the offset at that moment, then correct once in case daylight saving changes between.
  let t = asUtc - zoneOffsetMinutes(new Date(asUtc), timeZone) * 60_000;
  t = asUtc - zoneOffsetMinutes(new Date(t), timeZone) * 60_000;
  return new Date(t);
}
