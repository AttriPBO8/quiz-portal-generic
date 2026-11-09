import { getCurrentAdmin, userScope } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { logExport } from "@/lib/security";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return new Response("Not signed in", { status: 401 });
  const { attemptId } = await params;
  const attempt = await db.attempt.findFirst({ where: { id: attemptId, user: userScope(admin) }, include: { user: true, quiz: true } });
  if (!attempt) return new Response("Not found", { status: 404 });
  const questions = new Map((await db.question.findMany({ where: { id: { in: attempt.questionIds } } })).map((q) => [q.id, q]));
  const body = attempt.questionIds.map((id, i) => {
    const q = questions.get(id);
    const a = attempt.answers[i];
    return [i + 1, q?.externalId, q?.difficulty, q?.text, a >= 0 ? q?.options[a] : "", q?.options[q.correctIndex], a === -1 ? "Skipped" : a === q?.correctIndex ? "Correct" : "Wrong"];
  });
  const name = `${attempt.user.name}-${attempt.quiz.title}`.replace(/[^\w-]+/g, "_");
  const file = `attempt-${name}.csv`;
  await logExport(admin, file, body.length);
  return csvResponse(file, toCsv(["#", "Question id", "Level", "Question", "Answer given", "Correct answer", "Result"], body));
}
