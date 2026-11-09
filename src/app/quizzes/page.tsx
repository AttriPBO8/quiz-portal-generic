import Link from "next/link";
import { UserHeader } from "@/components/UserHeader";
import { requireUser } from "@/lib/auth";
import { finalizeExpiredAttempts } from "@/lib/attempts";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/constants";
import { quizStatusFor, quizWindow, type QuizStatus } from "@/lib/quiz-engine";
import { getQuizSite } from "@/lib/site";

export const dynamic = "force-dynamic";

const SECTIONS: { status: QuizStatus; title: string; empty: string }[] = [
  { status: "IN_PROGRESS", title: "In progress", empty: "Nothing in progress." },
  { status: "ASSIGNED", title: "Assigned", empty: "No new quizzes right now." },
  { status: "BLOCKED", title: "Blocked for now", empty: "" },
  { status: "COMPLETED", title: "Completed", empty: "You haven't passed a quiz yet." },
];


export default async function MyQuizzes({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  await finalizeExpiredAttempts(user.id);
  const { error } = await searchParams;
  const site = await getQuizSite();

  const assignments = await db.assignment.findMany({
    where: { userId: user.id, quiz: { active: true } },
    include: { quiz: { include: { attempts: { where: { userId: user.id }, orderBy: { startedAt: "desc" } } } } },
  });
  const cards = assignments.map(({ quiz }) => {
    const s = quizStatusFor(quiz.attempts);
    return { quiz, ...s, window: quizWindow(quiz), questions: quiz.numEasy + quiz.numMedium + quiz.numHard };
  });

  return (
    <>
      <UserHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold">Hello, {user.name.split(" ")[0]}</h1>
        <p className="text-muted">Here are the quizzes assigned to you.</p>

        {site.message && (
          <p role="status" className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-warning-text">{site.message} A quiz you have already started can still be finished.</p>
        )}

        {error === "no-questions" && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-danger">This quiz has no questions yet. Please tell your admin.</p>
        )}

        {SECTIONS.map((section) => {
          const list = cards.filter((c) => c.status === section.status);
          if (!list.length && !section.empty) return null;
          return (
            <section key={section.status} className="mt-8">
              <h2 className="mb-3 text-lg font-bold">{section.title} <span className="text-muted font-normal">({list.length})</span></h2>
              {list.length === 0 ? (
                <p className="card px-4 py-6 text-center text-muted">{section.empty}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((c) => (
                    <article key={c.quiz.id} className="card flex flex-col p-5">
                      <h3 className="text-lg font-semibold">{c.quiz.title}</h3>
                      <p className="mt-1 text-sm text-muted">{c.questions} questions · {c.quiz.timeLimitMinutes} minutes · pass mark {c.quiz.passingScore}%</p>
                      {c.quiz.closesAt && <p className="mt-1 text-sm text-muted">Complete by {formatDateTime(c.quiz.closesAt)}</p>}
                      {c.best !== null && <p className="mt-2 text-sm">Best score: <strong>{c.best}%</strong></p>}
                      <div className="mt-auto pt-4">
                        {c.status === "COMPLETED" ? (
                          <span className="inline-flex rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success">Passed</span>
                        ) : c.status === "BLOCKED" ? (
                          <p className="text-sm text-danger">Two attempts did not pass. You can try again after {formatDateTime(c.blockedUntil!)}.</p>
                        ) : !site.open && !c.openAttemptId ? (
                          <p className="text-sm text-muted">The quiz site is closed.</p>
                        ) : c.window === "NOT_OPEN" ? (
                          <p className="text-sm text-muted">Opens {formatDateTime(c.quiz.opensAt!)}</p>
                        ) : c.window === "CLOSED" ? (
                          <p className="text-sm text-muted">This quiz has closed.</p>
                        ) : (
                          <Link href={c.openAttemptId ? `/attempt/${c.openAttemptId}` : `/quizzes/${c.quiz.id}`} className="btn btn-primary w-full">
                            {c.openAttemptId ? "Resume quiz" : c.best !== null ? "Try again" : "Start quiz"}
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}
