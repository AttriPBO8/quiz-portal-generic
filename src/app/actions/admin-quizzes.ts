"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { quizScope, requireAdmin, requireSuperAdmin, userScope } from "@/lib/auth";
import { fromLocalInput } from "@/lib/constants";

export type QuizFormState = { error?: string; ok?: string } | undefined;

const count = z.coerce.number().int().min(0).max(100);
const settings = z.object({
  title: z.string().trim().min(3, "Give the quiz a title.").max(120),
  numEasy: count, numMedium: count, numHard: count,
  timeLimitMinutes: z.coerce.number().int().min(1).max(300),
  passingScore: z.coerce.number().int().min(1).max(100),
  opensAt: z.string().optional().transform((v) => fromLocalInput(v ?? "")),
  closesAt: z.string().optional().transform((v) => fromLocalInput(v ?? "")),
  active: z.string().optional().transform((v) => v === "on"),
}).refine((s) => s.numEasy + s.numMedium + s.numHard > 0, "Ask at least one question.")
  .refine((s) => !s.opensAt || !s.closesAt || s.opensAt < s.closesAt, "The close date must be after the open date.");

async function managedQuiz(quizId: string) {
  const admin = await requireAdmin();
  const quiz = await db.quiz.findFirst({ where: { id: quizId, ...quizScope(admin) } });
  if (!quiz) throw new Error("Quiz not found.");
  return { admin, quiz };
}

export async function createQuiz(_: QuizFormState, form: FormData): Promise<QuizFormState> {
  await requireSuperAdmin();
  const parsed = settings.safeParse({ ...Object.fromEntries(form), active: "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const bankId = String(form.get("bankId") ?? "");
  if (!(await db.questionBank.findUnique({ where: { id: bankId } }))) return { error: "Choose a question bank." };
  const quiz = await db.quiz.create({ data: { ...parsed.data, bankId } });
  redirect(`/admin/quizzes/${quiz.id}`);
}

export async function updateQuiz(quizId: string, _: QuizFormState, form: FormData): Promise<QuizFormState> {
  await managedQuiz(quizId);
  const parsed = settings.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.quiz.update({ where: { id: quizId }, data: parsed.data });
  revalidatePath(`/admin/quizzes/${quizId}`);
  return { ok: "Saved." };
}

export async function setQuizManagers(quizId: string, form: FormData) {
  await requireSuperAdmin();
  const ids = form.getAll("adminId").map(String);
  await db.$transaction([
    db.quizManager.deleteMany({ where: { quizId, adminId: { notIn: ids } } }),
    db.quizManager.createMany({ data: ids.map((adminId) => ({ quizId, adminId })), skipDuplicates: true }),
  ]);
  revalidatePath(`/admin/quizzes/${quizId}`);
}

/** Assigns (or removes) the quiz for every user matching the filters that this admin manages. */
export async function assignQuiz(quizId: string, _: QuizFormState, form: FormData): Promise<QuizFormState> {
  const { admin } = await managedQuiz(quizId);
  const roleType = (["TEACHER", "WORKER", "HELPER", "DUMMY"] as const).find((r) => r === form.get("roleType"));
  const where: Prisma.UserWhereInput = {
    ...userScope(admin),
    active: true,
    ...(form.get("districtId") ? { districtId: String(form.get("districtId")) } : {}),
    ...(form.get("blockId") ? { blockId: String(form.get("blockId")) } : {}),
    ...(roleType ? { roleType } : {}),
  };
  const users = await db.user.findMany({ where, select: { id: true } });
  if (form.get("mode") === "remove") {
    const { count } = await db.assignment.deleteMany({ where: { quizId, userId: { in: users.map((u) => u.id) } } });
    revalidatePath(`/admin/quizzes/${quizId}`);
    return { ok: `Removed the quiz from ${count} user${count === 1 ? "" : "s"}. Their past attempts are kept.` };
  }
  const { count } = await db.assignment.createMany({ data: users.map((u) => ({ quizId, userId: u.id })), skipDuplicates: true });
  revalidatePath(`/admin/quizzes/${quizId}`);
  return { ok: `Assigned to ${count} more user${count === 1 ? "" : "s"} (${users.length} matched; others already had it).` };
}
