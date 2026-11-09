import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionStats } from "@/lib/reports";
import { QuestionTable } from "./QuestionTable";

export default async function BankDetail({ params }: { params: Promise<{ bankId: string }> }) {
  await requireSuperAdmin();
  const { bankId } = await params;
  const bank = await db.questionBank.findUnique({ where: { id: bankId } });
  if (!bank) notFound();
  const rows = await questionStats(bankId);

  return (
    <div className="space-y-4">
      <Link href="/admin/questions" className="text-sm text-primary underline">← Question banks</Link>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{bank.name}</h1>
          <p className="text-muted">{rows.length} questions. Figures count submitted attempts by real users (Dummy accounts excluded). Skipped counts as wrong in scores.</p>
        </div>
        <a className="btn btn-secondary" href={`/admin/export/questions/${bank.id}`}>Download CSV</a>
      </div>
      <QuestionTable bankId={bank.id} rows={rows} />
    </div>
  );
}
