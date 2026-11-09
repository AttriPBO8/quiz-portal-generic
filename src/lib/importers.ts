import type { Difficulty, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { isEmail, isPhone, normalizeEmail, normalizePhone } from "./contact";
import { DEFAULT_ROLE } from "./constants";
import { protectPassword } from "./passwords";

// Turns uploaded files into database rows. Used by admin uploads and by the sample-data seed.
// Each importer checks every row and reports problems by row number instead of stopping at the first.

export type ImportReport = { created: number; updated: number; errors: { row: number; message: string }[] };

const yes = (v: string) => ["yes", "y", "true", "1"].includes(v.trim().toLowerCase());

/** One user's details, as typed in the Add user form or a CSV row. Shared by both. */
export const userFields = z
  .object({
    name: z.string().trim().min(1, "name is empty").max(100, "name is longer than 100 characters"),
    email: z.string().optional().default("").transform(normalizeEmail)
      .refine((v) => !v || isEmail(v), "email is not a valid email address"),
    phone: z.string().optional().default("").transform(normalizePhone)
      .refine((v) => !v || isPhone(v), "phone must have 7 to 15 digits (country code optional)"),
    role: z.string().trim().max(40, "role is longer than 40 characters").optional().default("").transform((v) => v || DEFAULT_ROLE),
    group: z.string().trim().max(80, "group is longer than 80 characters").optional().default(""),
    test_account: z.string().optional().default("").transform(yes),
  })
  .refine((u) => u.email || u.phone, "give an email, a phone number, or both");

const userRow = userFields.and(z.object({
  local_admin: z.string().trim().optional().default(""),
  password: z.string().optional().default(""),
}));

export const USER_COLUMNS = ["name", "email", "phone", "role", "group", "test_account", "local_admin", "password"];

/**
 * Users CSV columns: name, email, phone, role, group, test_account (yes/no), local_admin
 * (username, optional), password (optional; the starting password is used when empty).
 * Each row needs an email, a phone number, or both. A row whose email or phone already belongs
 * to a user updates that user; their password only changes when the file gives one.
 */
export async function importUsers(db: PrismaClient, rows: Record<string, string>[], defaultPassword: string): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, errors: [] };
  const admins = new Map((await db.admin.findMany({ where: { role: "LOCAL_ADMIN" } })).map((a) => [a.username.toLowerCase(), a.id]));
  const defaultProtected = await protectPassword(defaultPassword);
  const seen = new Map<string, number>();

  for (const [i, raw] of rows.entries()) {
    const rowNo = i + 2; // +1 for the header, +1 for 1-based numbering
    const parsed = userRow.safeParse(raw);
    if (!parsed.success) {
      report.errors.push({ row: rowNo, message: parsed.error.issues.map((x) => x.message).join("; ") });
      continue;
    }
    const r = parsed.data;
    const localAdminId = r.local_admin ? admins.get(r.local_admin.toLowerCase()) : undefined;
    if (r.local_admin && !localAdminId) {
      report.errors.push({ row: rowNo, message: `local_admin "${r.local_admin}" does not exist` });
      continue;
    }
    const dupe = [r.email, r.phone].filter(Boolean).map((k) => seen.get(k)).find(Boolean);
    if (dupe) {
      report.errors.push({ row: rowNo, message: `same email or phone as row ${dupe}` });
      continue;
    }
    [r.email, r.phone].filter(Boolean).forEach((k) => seen.set(k, rowNo));

    const matches = await db.user.findMany({
      where: { OR: [...(r.email ? [{ email: r.email }] : []), ...(r.phone ? [{ phone: r.phone }] : [])] },
    });
    if (matches.length > 1) {
      report.errors.push({ row: rowNo, message: "the email and the phone belong to two different users" });
      continue;
    }
    const existing = matches[0];
    const data = {
      name: r.name, role: r.role, group: r.group, testAccount: r.test_account,
      email: r.email || existing?.email || null, phone: r.phone || existing?.phone || null,
      ...(localAdminId ? { localAdminId } : {}),
    };
    const pw = r.password ? await protectPassword(r.password) : null;
    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: { ...data, ...(pw ? { ...pw, passwordChangedAt: null, sessionVersion: { increment: 1 } } : {}) },
      });
      report.updated++;
    } else {
      await db.user.create({ data: { ...data, ...(pw ?? defaultProtected) } });
      report.created++;
    }
  }
  return report;
}

const difficultyMap: Record<string, Difficulty> = { easy: "EASY", medium: "MEDIUM", hard: "HARD" };

const questionRow = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(50)),
    text: z.string().min(1, "text is empty").max(2000),
    options: z.array(z.string().min(1)).min(2, "needs at least 2 options").max(6, "at most 6 options"),
    correctOption: z.number().int().optional(),
    correctAnswer: z.number().int().optional(),
    difficulty: z.string().transform((v, ctx) => {
      const d = difficultyMap[v.trim().toLowerCase()];
      if (!d) ctx.addIssue({ code: "custom", message: "difficulty must be easy, medium or hard" });
      return d;
    }),
    category: z.string().max(80).optional(),
    /** Name of a file in the Media library, e.g. "bar-chart.png". */
    media: z.string().trim().max(120).optional(),
  })
  .transform((q, ctx) => {
    // correctOption counts from 1 (preferred). correctAnswer counts from 0 (older files).
    const index = q.correctOption !== undefined ? q.correctOption - 1 : q.correctAnswer;
    if (index === undefined || index < 0 || index >= q.options.length) {
      ctx.addIssue({ code: "custom", message: "correctOption must point at one of the options (1 = first)" });
    }
    return { ...q, correctIndex: index ?? 0 };
  });

/**
 * Question bank JSON: an array of
 * { id, text, options: [..], correctOption: 1-4, difficulty: "easy"|"medium"|"hard", category, media }.
 * "media" is optional: the name of a picture, sound or video already in the Media library.
 * Older files with a 0-based "correctAnswer" are accepted too.
 */
export async function importQuestions(db: PrismaClient, bankName: string, data: unknown): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, errors: [] };
  if (!Array.isArray(data)) {
    report.errors.push({ row: 0, message: "The file must contain a JSON list of questions." });
    return report;
  }
  const bank = await db.questionBank.upsert({ where: { name: bankName }, update: {}, create: { name: bankName } });
  const media = new Map((await db.mediaFile.findMany({ select: { id: true, name: true } })).map((m) => [m.name.toLowerCase(), m.id]));
  for (const [i, raw] of data.entries()) {
    const parsed = questionRow.safeParse(raw);
    if (!parsed.success) {
      report.errors.push({ row: i + 1, message: parsed.error.issues.map((x) => x.message).join("; ") });
      continue;
    }
    const q = parsed.data;
    const mediaId = q.media ? media.get(q.media.toLowerCase()) : null;
    if (q.media && !mediaId) {
      report.errors.push({ row: i + 1, message: `media "${q.media}" is not in the Media library. Upload it there first.` });
      continue;
    }
    const fields = { text: q.text, options: q.options, correctIndex: q.correctIndex, difficulty: q.difficulty, category: q.category || "General", active: true, mediaId: mediaId ?? null };
    const existing = await db.question.findUnique({ where: { bankId_externalId: { bankId: bank.id, externalId: q.id } } });
    if (existing) {
      await db.question.update({ where: { id: existing.id }, data: fields });
      report.updated++;
    } else {
      await db.question.create({ data: { ...fields, bankId: bank.id, externalId: q.id } });
      report.created++;
    }
  }
  return report;
}
