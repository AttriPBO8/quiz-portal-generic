import "server-only";
import { db } from "./db";
import { scoreAnswers } from "./quiz-engine";

// Grading happens only here, on the server. Correct answers never reach the browser.

/** Extra seconds allowed after the deadline for answers already on their way over the network. */
export const GRACE_SECONDS = 20;

/** Scores an in-progress attempt and marks it submitted. Safe to call twice. */
export async function finalizeAttempt(attemptId: string) {
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, include: { quiz: true } });
  if (!attempt || attempt.status === "SUBMITTED") return attempt;

  const questions = await db.question.findMany({ where: { id: { in: attempt.questionIds } }, select: { id: true, correctIndex: true } });
  const correctById = new Map(questions.map((q) => [q.id, q.correctIndex]));
  const correct = attempt.questionIds.map((id) => correctById.get(id) ?? -2);
  const { correctCount, score } = scoreAnswers(correct, attempt.answers);
  const now = new Date();

  // Only the first call wins, even if the browser submits and the timer expires together.
  await db.attempt.updateMany({
    where: { id: attemptId, status: "IN_PROGRESS" },
    data: {
      status: "SUBMITTED",
      submittedAt: now < attempt.deadline ? now : attempt.deadline,
      correctCount,
      score,
      passed: score >= attempt.quiz.passingScore,
    },
  });
  return db.attempt.findUnique({ where: { id: attemptId }, include: { quiz: true } });
}

/** Submits any of this person's attempts whose time has run out (for example, if they closed the tab). */
export async function finalizeExpiredAttempts(userId: string) {
  const cutoff = new Date(Date.now() - GRACE_SECONDS * 1000);
  const stale = await db.attempt.findMany({ where: { userId, status: "IN_PROGRESS", deadline: { lt: cutoff } }, select: { id: true } });
  for (const a of stale) await finalizeAttempt(a.id);
}
