import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

// Passwords are stored only as bcrypt hashes. Nobody, admins included, can read them back.

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Returns an error message, or null when the password is acceptable. */
export function checkPasswordStrength(plain: string): string | null {
  if (plain.length < 8) return "Use at least 8 characters.";
  if (plain.length > 64) return "Use at most 64 characters.";
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) return "Use both letters and numbers.";
  return null;
}

/** A random alphanumeric password with at least one letter and one digit (no look-alike characters). */
export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  for (;;) {
    const pw = Array.from(randomBytes(length), (b) => chars[b % chars.length]).join("");
    if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) return pw;
  }
}

export async function protectPassword(plain: string) {
  return { passwordHash: await hashPassword(plain) };
}
