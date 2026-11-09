import Link from "next/link";
import { quizScope, requireAdmin, userScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/constants";
import { NewQuizForm } from "./QuizForms";

export default async function Quizzes() {
  const admin = await requireAdmin();
  const isSuper = admin.role === "SUPER_ADMIN";
  const quizzes = await db.quiz.findMany({
    where: quizScope(admin),
    include: { bank: true, _count: { select: { assignments: { where: { user: userScope(admin) } } } } },
    orderBy: { createdAt: "desc" },
  });
  const banks = isSuper ? await db.questionBank.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { questions: true } } } }) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <p className="text-muted">{isSuper ? "All quizzes. Open one to change its settings, choose its Local Admins, or assign it." : "Quizzes you manage. Open one to change its settings or assign it to your users."}</p>
      </div>
      {isSuper && <NewQuizForm banks={banks.map((b) => ({ id: b.id, name: `${b.name} (${b._count.questions} questions)` }))} />}
      {quizzes.length === 0 ? (
        <p className="card px-4 py-8 text-center text-muted">No quizzes yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Quiz</th><th>Question bank</th><th className="text-right">Questions</th><th className="text-right">Minutes</th><th className="text-right">Pass mark</th><th>Open</th><th>Close</th><th className="text-right">Assigned</th><th>Status</th></tr></thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td><Link className="font-semibold text-primary underline" href={`/admin/quizzes/${q.id}`}>{q.title}</Link></td>
                  <td>{q.bank.name}</td>
                  <td className="text-right">{q.numEasy + q.numMedium + q.numHard}</td>
                  <td className="text-right">{q.timeLimitMinutes}</td>
                  <td className="text-right">{q.passingScore}%</td>
                  <td>{formatDate(q.opensAt) || "Any time"}</td>
                  <td>{formatDate(q.closesAt) || "No end"}</td>
                  <td className="text-right">{q._count.assignments}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${q.active ? "bg-success-soft text-success" : "bg-surface-2 text-muted"}`}>{q.active ? "Active" : "Hidden"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
