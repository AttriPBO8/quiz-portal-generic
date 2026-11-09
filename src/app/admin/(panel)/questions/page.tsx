import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadQuestions } from "./UploadQuestions";

export default async function QuestionBanks() {
  await requireSuperAdmin();
  const banks = await db.questionBank.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { quizzes: true } } } });
  const counts = await db.question.groupBy({ by: ["bankId", "difficulty"], where: { active: true }, _count: true });
  const n = (bankId: string, d: string) => counts.find((c) => c.bankId === bankId && c.difficulty === d)?._count ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Question banks</h1>
        <p className="text-muted">Each subject has its own bank. A quiz draws its questions from one bank.</p>
      </div>
      <UploadQuestions banks={banks.map((b) => b.name)} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banks.map((b) => (
          <Link key={b.id} href={`/admin/questions/${b.id}`} className="card block p-5 hover:border-primary">
            <h2 className="text-lg font-semibold">{b.name}</h2>
            <p className="mt-1 text-sm text-muted">{n(b.id, "EASY")} easy · {n(b.id, "MEDIUM")} medium · {n(b.id, "HARD")} hard</p>
            <p className="mt-1 text-sm text-muted">Used by {b._count.quizzes} quiz{b._count.quizzes === 1 ? "" : "zes"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
