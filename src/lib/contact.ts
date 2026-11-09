// Email addresses and phone numbers: how they are cleaned up, checked and shown.
// Used at sign-in, when admins add users, and in logs. Works in the browser too.

/** Lower case, no spaces. */
export const normalizeEmail = (v: string) => v.trim().toLowerCase();

/** Digits only. "+1 (416) 555-0101" and "14165550101" are the same number. */
export const normalizePhone = (v: string) => v.replace(/\D/g, "");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmail = (v: string) => EMAIL.test(v) && v.length <= 254;
/** 7 to 15 digits: the international (E.164) range, with or without the country code. */
export const isPhone = (digits: string) => /^\d{7,15}$/.test(digits);

/**
 * Reads what someone typed in the sign-in box. Anything with an "@" is an email address;
 * anything else is treated as a phone number.
 */
export function parseLoginId(raw: string): { email: string } | { phone: string } | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes("@")) {
    const email = normalizeEmail(v);
    return isEmail(email) ? { email } : null;
  }
  if (/[a-z]/i.test(v)) return null;
  const phone = normalizePhone(v);
  return isPhone(phone) ? { phone } : null;
}

/**
 * Phone numbers that should count as the same person at sign-in, so a user can type their number
 * with or without the country code. DEFAULT_COUNTRY_CODE (for example "1" or "91") is the code
 * your users usually leave off. The number exactly as typed is always tried first.
 */
export function phoneCandidates(digits: string, defaultCountryCode = "") {
  const out = [digits];
  const cc = defaultCountryCode.replace(/\D/g, "");
  if (cc && digits.startsWith(cc) && digits.length - cc.length >= 7) out.push(digits.slice(cc.length));
  if (cc && !digits.startsWith(cc) && digits.length <= 15 - cc.length) out.push(cc + digits);
  return Array.from(new Set(out));
}

/** Shows only the last 4 digits of a phone number, enough to tell people apart in a log. */
export const maskPhone = (phone: string) => (phone.length > 4 ? `${"*".repeat(phone.length - 4)}${phone.slice(-4)}` : "****");

/** "asha.k@example.com" becomes "as***@example.com". */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Name plus masked contact, for the security log. */
export const userLabel = (u: { name?: string | null; email?: string | null; phone?: string | null }) =>
  `${u.name ?? "unknown"} (${[u.email && maskEmail(u.email), u.phone && maskPhone(u.phone)].filter(Boolean).join(", ") || "no contact"})`;
