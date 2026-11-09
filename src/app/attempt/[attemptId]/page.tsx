import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { finalizeAttempt, GRACE_SECONDS } from "@/lib/attempts";
import { db } from "@/lib/db";
import { QuizRunner } from "./QuizRunner";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireUser();
  const { attemptId } = await params;
  const attempt = await db.attempt.findFirst({ where: { id: attemptId, userId: user.id }, include: { quiz: true } });
  if (!attempt) notFound();
  if (attempt.status === "SUBMITTED") redirect(`/attempt/${attempt.id}/result`);
  if (attempt.deadline.getTime() + GRACE_SECONDS * 1000 < Date.now()) {
    await finalizeAttempt(attempt.id);
    redirect(`/attempt/${attempt.id}/result`);
  }

  // Only the question text and options go to the browser, never the correct answer.
  const rows = await db.question.findMany({ where: { id: { in: attempt.questionIds } }, select: { id: true, text: true, options: true } });
  const byId = new Map(rows.map((q) => [q.id, q]));
  const questions = attempt.questionIds.map((id) => ({ text: byId.get(id)?.text ?? "(question removed)", options: byId.get(id)?.options ?? [] }));

  return (
    <QuizRunner
      attemptId={attempt.id}
      title={attempt.quiz.title}
      userName={user.name}
      questions={questions}
      initialAnswers={attempt.answers}
      initialFlagged={attempt.flagged}
      deadline={attempt.deadline.getTime()}
      serverNow={Date.now()}
    />
  );
}
