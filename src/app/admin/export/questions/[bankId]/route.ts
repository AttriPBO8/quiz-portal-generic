import { getCurrentAdmin } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { logExport } from "@/lib/security";
import { db } from "@/lib/db";
import { questionStats } from "@/lib/reports";

export async function GET(_: Request, { params }: { params: Promise<{ bankId: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "SUPER_ADMIN") return new Response("Not allowed", { status: 403 });
  const { bankId } = await params;
  const bank = await db.questionBank.findUnique({ where: { id: bankId } });
  if (!bank) return new Response("Not found", { status: 404 });
  const rows = await questionStats(bankId);
  const file = `questions-${bank.name.replace(/[^\w-]+/g, "_")}.csv`;
  await logExport(admin, file, rows.length);
  return csvResponse(file, toCsv(
    ["Question id", "Level", "Category", "Question", "Correct answer", "Times asked", "Correct", "Wrong", "Skipped", "% correct", "In use"],
    rows.map((r) => [r.id, r.difficulty, r.category, r.text, r.correctAnswer, r.asked, r.correct, r.wrong, r.skipped, r.correctRate, r.active ? "Yes" : "No"]),
  ));
}
