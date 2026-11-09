"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { currentUserId, requireUser } from "@/lib/auth";
import { finalizeAttempt, finalizeExpiredAttempts, GRACE_SECONDS } from "@/lib/attempts";
import { quizStatusFor, quizWindow, selectQuestions } from "@/lib/quiz-engine";
import { getQuizSite } from "@/lib/site";

/** Starts (or resumes) the quiz for the signed-in person, after they accepted the honor code. */
export async function startQuiz(quizId: string) {
  const user = await requireUser();
  await finalizeExpiredAttempts(user.id);

  const assignment = await db.assignment.findUnique({ where: { quizId_userId: { quizId, userId: user.id } }, include: { quiz: true } });
  if (!assignment || !assignment.quiz.active) redirect("/quizzes");
  const quiz = assignment.quiz;
  if (quizWindow(quiz) !== "OPEN" || !(await getQuizSite()).open) redirect("/quizzes");

  const attempts = await db.attempt.findMany({ where: { userId: user.id, quizId } });
  const status = quizStatusFor(attempts);
  if (status.status === "COMPLETED" || status.status === "BLOCKED") redirect("/quizzes");
  if (status.openAttemptId) redirect(`/attempt/${status.openAttemptId}`);

  const pool = await db.question.findMany({ where: { bankId: quiz.bankId, active: true }, select: { id: true, difficulty: true } });
  const questionIds = selectQuestions({
    pool,
    counts: { EASY: quiz.numEasy, MEDIUM: quiz.numMedium, HARD: quiz.numHard },
    seen: new Set(attempts.flatMap((a) => a.questionIds)),
    isRetake: attempts.length > 0,
  });
  if (questionIds.length === 0) redirect("/quizzes?error=no-questions");

  let deadline = new Date(Date.now() + quiz.timeLimitMinutes * 60_000);
  if (quiz.closesAt && quiz.closesAt < deadline) deadline = quiz.closesAt;

  const attempt = await db.attempt.create({
    data: {
      userId: user.id,
      quizId,
      deadline,
      questionIds,
      answers: questionIds.map(() => -1),
      flagged: [],
      userAgent: (await headers()).get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  redirect(`/attempt/${attempt.id}`);
}

/** Saves one answer as soon as it is chosen. Returns false if the attempt is no longer open. */
export async function saveAnswer(attemptId: string, position: number, choice: number): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  if (!Number.isInteger(position) || !Number.isInteger(choice) || position < 0 || choice < -1 || choice > 9) return false;
  // One atomic update, so quick taps on different questions never overwrite each other.
  const changed = await db.$executeRaw`
    UPDATE "Attempt" SET answers[${position + 1}] = ${choice}
    WHERE id = ${attemptId} AND "userId" = ${userId} AND status = 'IN_PROGRESS'
      AND deadline > now() - make_interval(secs => ${GRACE_SECONDS})
      AND ${position + 1} <= cardinality(answers)`;
  return changed === 1;
}

export async function setFlag(attemptId: string, position: number, flagged: boolean): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  if (!Number.isInteger(position) || position < 0 || position > 500) return false;
  const changed = flagged
    ? await db.$executeRaw`UPDATE "Attempt" SET flagged = array_append(array_remove(flagged, ${position}), ${position})
        WHERE id = ${attemptId} AND "userId" = ${userId} AND status = 'IN_PROGRESS'`
    : await db.$executeRaw`UPDATE "Attempt" SET flagged = array_remove(flagged, ${position})
        WHERE id = ${attemptId} AND "userId" = ${userId} AND status = 'IN_PROGRESS'`;
  return changed === 1;
}

/** Submits the attempt. The browser sends all its answers once more in case a save was missed. */
export async function submitAttempt(attemptId: string, answers: number[]) {
  const user = await requireUser();
  const attempt = await db.attempt.findFirst({ where: { id: attemptId, userId: user.id } });
  if (!attempt) redirect("/quizzes");
  if (attempt.status === "IN_PROGRESS") {
    const inTime = attempt.deadline.getTime() + GRACE_SECONDS * 1000 > Date.now();
    const valid = Array.isArray(answers) && answers.length === attempt.questionIds.length && answers.every((a) => Number.isInteger(a) && a >= -1 && a <= 9);
    if (inTime && valid) await db.attempt.updateMany({ where: { id: attemptId, status: "IN_PROGRESS" }, data: { answers } });
    await finalizeAttempt(attemptId);
  }
  redirect(`/attempt/${attemptId}/result`);
}
