import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, userScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, roleLabel } from "@/lib/constants";
import { SortableTable } from "@/components/SortableTable";

export default async function AttemptDetail({ params }: { params: Promise<{ attemptId: string }> }) {
  const admin = await requireAdmin();
  const { attemptId } = await params;
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, user: userScope(admin) },
    include: { quiz: true, user: { include: { district: true, block: true } } },
  });
  if (!attempt) notFound();
  const all = await db.attempt.findMany({ where: { userId: attempt.userId, quizId: attempt.quizId }, orderBy: { startedAt: "asc" }, select: { id: true, startedAt: true, score: true, status: true } });
  const questions = await db.question.findMany({ where: { id: { in: attempt.questionIds } } });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const letter = (i: number) => (i >= 0 ? String.fromCharCode(65 + i) : "");
  const rows = attempt.questionIds.map((id, i) => {
    const q = byId.get(id);
    const a = attempt.answers[i];
    return {
      n: i + 1,
      id: q?.externalId ?? id,
      difficulty: q?.difficulty ?? "",
      text: q?.text ?? "(removed)",
      given: a >= 0 && q ? `${letter(a)}. ${q.options[a]}` : "",
      correct: q ? `${letter(q.correctIndex)}. ${q.options[q.correctIndex]}` : "",
      result: a === -1 ? "Skipped" : q && a === q.correctIndex ? "Correct" : "Wrong",
    };
  });
  const u = attempt.user;

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-primary underline">← Results</Link>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{u.name} · {attempt.quiz.title}</h1>
          <p className="text-muted">{roleLabel(u.roleType)} · {u.block.name}, {u.district.name} · {u.phone}</p>
        </div>
        {attempt.passed && <Link className="btn btn-primary" href={`/admin/certificates?attempt=${attempt.id}`}>Certificate of Completion</Link>}
        <a className="btn btn-secondary" href={`/admin/export/attempt/${attempt.id}`}>Download CSV</a>
      </div>
      <div className="flex flex-wrap gap-2">
        {all.map((a, i) => (
          <Link key={a.id} href={`/admin/attempts/${a.id}`} className={`rounded-full border px-3 py-1 text-sm ${a.id === attempt.id ? "border-primary bg-primary-soft font-semibold" : "border-border"}`}>
            Attempt {i + 1}: {a.status === "SUBMITTED" ? `${a.score}%` : "in progress"} · {formatDate(a.startedAt)}
          </Link>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">Score</dt><dd className="text-2xl font-bold">{attempt.score ?? "-"}{attempt.score !== null && "%"}</dd></div>
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">Result</dt><dd className={`text-2xl font-bold ${attempt.passed ? "text-success" : "text-danger"}`}>{attempt.status === "IN_PROGRESS" ? "In progress" : attempt.passed ? "Passed" : "Not passed"}</dd></div>
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">Correct</dt><dd className="text-2xl font-bold">{attempt.correctCount ?? "-"} / {attempt.questionIds.length}</dd></div>
        <div className="card p-4"><dt className="text-xs font-semibold uppercase text-muted">Started</dt><dd className="text-lg font-bold">{formatDateTime(attempt.startedAt)}</dd></div>
      </dl>
      <SortableTable
        defaultSort={["n"]}
        columns={[
          { key: "n", label: "#", numeric: true },
          { key: "id", label: "Question id" },
          { key: "difficulty", label: "Level" },
          { key: "text", label: "Question", wrap: true },
          { key: "given", label: "Answer given" },
          { key: "correct", label: "Correct answer" },
          { key: "result", label: "Result", badge: true },
        ]}
        rows={rows}
      />
    </div>
  );
}
