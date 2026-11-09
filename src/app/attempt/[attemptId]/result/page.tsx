import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UserHeader } from "@/components/UserHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { quizStatusFor } from "@/lib/quiz-engine";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireUser();
  const { attemptId } = await params;
  const attempt = await db.attempt.findFirst({ where: { id: attemptId, userId: user.id }, include: { quiz: true } });
  if (!attempt) notFound();
  if (attempt.status !== "SUBMITTED") redirect(`/attempt/${attempt.id}`);

  const total = attempt.questionIds.length;
  const answered = attempt.answers.filter((a) => a !== -1).length;
  const correct = attempt.correctCount ?? 0;
  const minutes = Math.max(1, Math.round(((attempt.submittedAt ?? attempt.deadline).getTime() - attempt.startedAt.getTime()) / 60000));
  const status = quizStatusFor(await db.attempt.findMany({ where: { userId: user.id, quizId: attempt.quizId } }));
  const passed = attempt.passed;

  const stats = [
    { label: "Correct", value: correct, tone: "text-success" },
    { label: "Wrong", value: answered - correct, tone: "text-danger" },
    { label: "Not answered", value: total - answered, tone: "text-muted" },
    { label: "Time taken", value: `${minutes} min`, tone: "" },
  ];

  return (
    <>
      <UserHeader user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-sm font-semibold text-primary">{attempt.quiz.title}</p>
        <section className={`card mt-2 overflow-hidden text-center`}>
          <div className={`px-6 py-8 ${passed ? "bg-success-soft" : "bg-surface-2"}`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your score</p>
            <p className="mt-1 text-6xl font-extrabold tabular-nums">{attempt.score}<span className="text-3xl text-muted">/100</span></p>
            <p className={`mt-3 inline-flex rounded-full px-4 py-1 font-bold ${passed ? "bg-success text-white" : "bg-danger-soft text-danger"}`}>
              {passed ? "Passed" : `Not passed · pass mark ${attempt.quiz.passingScore}`}
            </p>
            <p className="mt-4 text-muted">
              {passed
                ? "Well done! This quiz is now in your Completed list."
                : status.status === "BLOCKED"
                  ? "You can try again in 24 hours, with a new set of questions."
                  : "You can try again now with a new set of questions."}
            </p>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="border-t border-border p-4 sm:border-l sm:first:border-l-0">
                <dt className="text-xs font-semibold uppercase text-muted">{s.label}</dt>
                <dd className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/quizzes" className="btn btn-primary">Back to my quizzes</Link>
        </div>
      </main>
    </>
  );
}
