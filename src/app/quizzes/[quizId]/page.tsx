import { notFound } from "next/navigation";
import { UserHeader } from "@/components/UserHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HONOR_CODE } from "@/lib/constants";
import { HonorCode } from "./HonorCode";

export const dynamic = "force-dynamic";

export default async function QuizIntro({ params }: { params: Promise<{ quizId: string }> }) {
  const user = await requireUser();
  const { quizId } = await params;
  const assignment = await db.assignment.findUnique({ where: { quizId_userId: { quizId, userId: user.id } }, include: { quiz: true } });
  if (!assignment || !assignment.quiz.active) notFound();
  const q = assignment.quiz;

  return (
    <>
      <UserHeader user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-sm font-semibold text-primary">Before you begin</p>
        <h1 className="text-2xl font-bold">{q.title}</h1>
        <HonorCode
          quizId={q.id}
          statements={HONOR_CODE}
          rules={{ questions: q.numEasy + q.numMedium + q.numHard, minutes: q.timeLimitMinutes, passingScore: q.passingScore }}
        />
      </main>
    </>
  );
}
