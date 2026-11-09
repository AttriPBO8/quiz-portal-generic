import "server-only";
import type { Admin, Prisma } from "@prisma/client";
import { db } from "./db";
import { quizScope, userScope } from "./auth";
import { formatDate } from "./constants";
import { quizStatusFor, type QuizStatus } from "./quiz-engine";

// Read-only queries behind the admin results screens and their CSV downloads.
// Every query is limited to what the signed-in admin may see.

export type ResultFilters = { quizId?: string; group?: string; role?: string; test?: string; status?: string; q?: string };

/** Filters shared by the Results and Users screens. Test accounts are left out unless asked for. */
export function userFilter(f: { group?: string; role?: string; test?: string; q?: string }): Prisma.UserWhereInput {
  return {
    ...(f.group ? { group: f.group } : {}),
    ...(f.role ? { role: f.role } : {}),
    testAccount: f.test === "only" ? true : f.test === "all" ? undefined : false,
    ...(f.q ? { OR: [
      { name: { contains: f.q, mode: "insensitive" } },
      { email: { contains: f.q.toLowerCase() } },
      { phone: { contains: f.q.replace(/\D/g, "") || f.q } },
    ] } : {}),
  };
}

export const STATUS_LABEL: Record<QuizStatus, string> = {
  ASSIGNED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Passed",
};

const fmtDate = formatDate;

export async function getResultRows(admin: Pick<Admin, "id" | "role">, f: ResultFilters) {
  const userWhere: Prisma.UserWhereInput = { ...userScope(admin), ...userFilter(f) };
  const assignments = await db.assignment.findMany({
    where: { user: userWhere, quiz: { ...quizScope(admin), ...(f.quizId ? { id: f.quizId } : {}) } },
    select: {
      quiz: { select: { id: true, title: true, closesAt: true } },
      user: {
        select: {
          id: true, name: true, email: true, phone: true, role: true, group: true, testAccount: true,
          localAdmin: { select: { name: true } },
          attempts: {
            select: { id: true, quizId: true, status: true, passed: true, score: true, submittedAt: true, deadline: true, startedAt: true },
            orderBy: { startedAt: "desc" },
          },
        },
      },
    },
    take: 20000,
  });

  const rows = assignments.map(({ quiz, user }) => {
    const attempts = user.attempts.filter((a) => a.quizId === quiz.id);
    const s = quizStatusFor(attempts);
    const firstPass = attempts.filter((a) => a.passed).sort((a, b) => a.submittedAt!.getTime() - b.submittedAt!.getTime())[0];
    const passedAt = firstPass?.submittedAt;
    return {
      userId: user.id,
      quizId: quiz.id,
      group: user.group,
      role: user.role,
      name: user.testAccount ? `${user.name} (test)` : user.name,
      email: user.email ?? "",
      phone: user.phone ?? "",
      localAdmin: user.localAdmin?.name ?? "",
      quiz: quiz.title,
      status: s.status,
      statusLabel: STATUS_LABEL[s.status],
      best: s.best,
      attempts: attempts.filter((a) => a.status === "SUBMITTED").length,
      lastAttemptId: attempts[0]?.id ?? null,
      passedAttemptId: firstPass?.id ?? null,
      lastAttempt: fmtDate(attempts[0]?.startedAt),
      completedOn: fmtDate(passedAt),
      dueBy: fmtDate(quiz.closesAt),
    };
  });
  return f.status ? rows.filter((r) => r.status === f.status) : rows;
}

export function summarize(rows: { status: QuizStatus }[]) {
  const count = (s: QuizStatus) => rows.filter((r) => r.status === s).length;
  const passed = count("COMPLETED");
  return { assigned: rows.length, passed, inProgress: count("IN_PROGRESS"), notStarted: count("ASSIGNED"), blocked: count("BLOCKED"), passRate: rows.length ? Math.round((passed / rows.length) * 100) : 0 };
}

/** Options for the Group / Role / Quiz filters, limited to what the admin can see. */
export async function filterOptions(admin: Pick<Admin, "id" | "role">) {
  const scope = userScope(admin);
  const [groups, roles, quizzes] = await Promise.all([
    db.user.findMany({ where: { ...scope, group: { not: "" } }, distinct: ["group"], orderBy: { group: "asc" }, select: { group: true } }),
    db.user.findMany({ where: scope, distinct: ["role"], orderBy: { role: "asc" }, select: { role: true } }),
    db.quiz.findMany({ where: quizScope(admin), orderBy: { createdAt: "desc" }, select: { id: true, title: true } }),
  ]);
  return { groups: groups.map((g) => g.group), roles: roles.map((r) => r.role), quizzes };
}

/** The filter drop-downs for people: group, role and test accounts. */
export function peopleFilters(opts: { groups: string[]; roles: string[] }, groupLabel: string) {
  const list = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
  return [
    { name: "group", label: groupLabel, options: list(opts.groups) },
    { name: "role", label: "Role", options: list(opts.roles) },
    { name: "test", label: "Test accounts", allLabel: "Hide test accounts", options: [{ value: "only", label: "Only test accounts" }, { value: "all", label: "Include test accounts" }] },
  ];
}

/** Per-question figures for one question bank: times asked, correct, wrong or skipped. */
export async function questionStats(bankId: string, quizIds?: string[]) {
  const questions = await db.question.findMany({ where: { bankId }, orderBy: { externalId: "asc" }, include: { media: { select: { name: true } } } });
  const attempts = await db.attempt.findMany({
    where: { status: "SUBMITTED", quiz: { bankId, ...(quizIds ? { id: { in: quizIds } } : {}) }, user: { testAccount: false } },
    select: { questionIds: true, answers: true },
  });
  const stats = new Map(questions.map((q) => [q.id, { asked: 0, correct: 0, skipped: 0 }]));
  const correctIndex = new Map(questions.map((q) => [q.id, q.correctIndex]));
  for (const a of attempts) {
    a.questionIds.forEach((id, i) => {
      const s = stats.get(id);
      if (!s) return;
      s.asked++;
      if (a.answers[i] === -1) s.skipped++;
      else if (a.answers[i] === correctIndex.get(id)) s.correct++;
    });
  }
  return questions.map((q) => {
    const s = stats.get(q.id)!;
    return {
      id: q.externalId, text: q.text, media: q.media?.name ?? "", difficulty: q.difficulty, category: q.category, active: q.active,
      correctAnswer: q.options[q.correctIndex] ?? "", asked: s.asked, correct: s.correct,
      wrong: s.asked - s.correct - s.skipped, skipped: s.skipped,
      correctRate: s.asked ? Math.round((s.correct / s.asked) * 100) : null,
    };
  });
}
