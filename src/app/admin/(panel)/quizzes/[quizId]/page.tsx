import Link from "next/link";
import { notFound } from "next/navigation";
import { quizScope, requireAdmin, userScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { toLocalInput } from "@/lib/constants";
import { filterOptions, getResultRows, summarize } from "@/lib/reports";
import { setQuizManagers } from "@/app/actions/admin-quizzes";
import { AssignForm, EditQuizForm } from "../QuizForms";

export default async function QuizDetail({ params }: { params: Promise<{ quizId: string }> }) {
  const admin = await requireAdmin();
  const { quizId } = await params;
  const quiz = await db.quiz.findFirst({ where: { id: quizId, ...quizScope(admin) }, include: { bank: true, managers: true } });
  if (!quiz) notFound();
  const isSuper = admin.role === "SUPER_ADMIN";
  const [opts, rows, available, localAdmins] = await Promise.all([
    filterOptions(admin),
    getResultRows(admin, { quizId }),
    db.question.groupBy({ by: ["difficulty"], where: { bankId: quiz.bankId, active: true }, _count: true }),
    isSuper ? db.admin.findMany({ where: { role: "LOCAL_ADMIN" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const sum = summarize(rows);
  const have = (d: string) => available.find((a) => a.difficulty === d)?._count ?? 0;
  const managerIds = new Set(quiz.managers.map((m) => m.adminId));
  const assignedTotal = await db.assignment.count({ where: { quizId, user: userScope(admin) } });

  return (
    <div className="space-y-5">
      <Link href="/admin/quizzes" className="text-sm text-primary underline">← Quizzes</Link>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          <p className="text-muted">Question bank: {quiz.bank.name} · has {have("EASY")} easy, {have("MEDIUM")} medium, {have("HARD")} hard questions</p>
        </div>
        <Link className="btn btn-secondary" href={`/admin?quizId=${quiz.id}`}>See results</Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">Assigned</dt><dd className="text-2xl font-bold">{assignedTotal}</dd></div>
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">Passed</dt><dd className="text-2xl font-bold text-success">{sum.passed}</dd></div>
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">In progress</dt><dd className="text-2xl font-bold">{sum.inProgress}</dd></div>
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">Pass rate</dt><dd className="text-2xl font-bold">{sum.passRate}%</dd></div>
      </dl>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold">Settings</h2>
        <EditQuizForm quizId={quiz.id} settings={{
          title: quiz.title, numEasy: quiz.numEasy, numMedium: quiz.numMedium, numHard: quiz.numHard,
          timeLimitMinutes: quiz.timeLimitMinutes, passingScore: quiz.passingScore,
          opensAt: toLocalInput(quiz.opensAt), closesAt: toLocalInput(quiz.closesAt), active: quiz.active,
        }} />
        <p className="mt-3 text-sm text-muted">Changes apply to attempts started after saving. If a level has too few questions, the quiz fills in from the other levels.</p>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Assign</h2>
        <p className="mb-4 text-sm text-muted">Pick who should get this quiz. {isSuper ? "" : "Only your own users are included."} New users added later need to be assigned too.</p>
        <AssignForm quizId={quiz.id} districts={opts.districts} blocks={opts.blocks} />
      </section>

      {isSuper && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">Local Admins for this quiz</h2>
          <p className="mb-4 text-sm text-muted">Ticked Local Admins can see this quiz, change its settings and assign it to their own users.</p>
          <form action={setQuizManagers.bind(null, quiz.id)} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {localAdmins.map((a) => (
                <label key={a.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
                  <input type="checkbox" name="adminId" value={a.id} defaultChecked={managerIds.has(a.id)} className="h-5 w-5" /> {a.name} <span className="text-sm text-muted">({a.username})</span>
                </label>
              ))}
            </div>
            {localAdmins.length ? <button className="btn btn-primary">Save Local Admins</button> : <p className="text-muted">No Local Admins yet.</p>}
          </form>
        </section>
      )}
    </div>
  );
}
