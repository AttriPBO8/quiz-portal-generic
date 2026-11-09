import type { Difficulty, PrismaClient, RoleType } from "@prisma/client";
import { z } from "zod";
import { protectPassword } from "./passwords";

// Turns uploaded files into database rows. Used by admin uploads and by the sample-data seed.
// Each importer checks every row and reports problems by row number instead of stopping at the first.

export type ImportReport = { created: number; updated: number; errors: { row: number; message: string }[] };

const roleMap: Record<string, RoleType> = { teacher: "TEACHER", worker: "WORKER", helper: "HELPER", dummy: "DUMMY" };

const userRow = z.object({
  district: z.string().min(1, "district is empty").max(80),
  block: z.string().min(1, "block is empty").max(80),
  role_type: z.string().transform((v, ctx) => {
    const r = roleMap[v.trim().toLowerCase()];
    if (!r) ctx.addIssue({ code: "custom", message: "role_type must be Teacher, Worker, Helper or Dummy" });
    return r;
  }),
  phone: z.string().regex(/^[6-9]\d{9}$/, "phone must be a 10-digit mobile number"),
  name: z.string().min(1, "name is empty").max(100),
  local_admin: z.string().optional().default(""),
  password: z.string().optional().default(""),
});

/**
 * Users CSV columns: district, block, role_type, phone, name, local_admin (username, optional),
 * password (optional; the default password is used when empty).
 * Existing users (same district + block + role type + phone) are updated; their password only
 * changes when the file gives one.
 */
export async function importUsers(db: PrismaClient, rows: Record<string, string>[], defaultPassword: string): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, errors: [] };
  const admins = new Map((await db.admin.findMany({ where: { role: "LOCAL_ADMIN" } })).map((a) => [a.username.toLowerCase(), a.id]));
  const defaultProtected = await protectPassword(defaultPassword);

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
    const district = await db.district.upsert({ where: { name: r.district }, update: {}, create: { name: r.district } });
    const block = await db.block.upsert({
      where: { districtId_name: { districtId: district.id, name: r.block } },
      update: {},
      create: { name: r.block, districtId: district.id },
    });
    const key = { districtId: district.id, blockId: block.id, roleType: r.role_type, phone: r.phone };
    const existing = await db.user.findUnique({ where: { districtId_blockId_roleType_phone: key } });
    const pw = r.password ? await protectPassword(r.password) : null;
    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: r.name,
          ...(localAdminId ? { localAdminId } : {}),
          ...(pw ? { ...pw, sessionVersion: { increment: 1 } } : {}),
        },
      });
      report.updated++;
    } else {
      await db.user.create({ data: { ...key, name: r.name, localAdminId, ...(pw ?? defaultProtected) } });
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
 * { id, text, options: [..], correctOption: 1-4, difficulty: "easy"|"medium"|"hard", category }.
 * Older files with a 0-based "correctAnswer" are accepted too.
 */
export async function importQuestions(db: PrismaClient, bankName: string, data: unknown): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, errors: [] };
  if (!Array.isArray(data)) {
    report.errors.push({ row: 0, message: "The file must contain a JSON list of questions." });
    return report;
  }
  const bank = await db.questionBank.upsert({ where: { name: bankName }, update: {}, create: { name: bankName } });
  for (const [i, raw] of data.entries()) {
    const parsed = questionRow.safeParse(raw);
    if (!parsed.success) {
      report.errors.push({ row: i + 1, message: parsed.error.issues.map((x) => x.message).join("; ") });
      continue;
    }
    const q = parsed.data;
    const fields = { text: q.text, options: q.options, correctIndex: q.correctIndex, difficulty: q.difficulty, category: q.category || "General", active: true };
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
