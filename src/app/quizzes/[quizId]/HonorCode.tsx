"use client";

import { useState, useTransition } from "react";
import { startQuiz } from "@/app/actions/quiz";

// Honor code with an "I agree" button, then a pop-up with the quiz rules and a Start button.

export function HonorCode({ quizId, statements, rules }: {
  quizId: string;
  statements: string[];
  rules: { questions: number; minutes: number; passingScore: number };
}) {
  const [agreed, setAgreed] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Honor code</h2>
        <ul className="mt-3 space-y-2">
          {statements.map((s) => (
            <li key={s} className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />{s}</li>
          ))}
        </ul>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg bg-surface-2 p-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--primary)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span className="font-medium">I have read the honor code and I will follow it.</span>
        </label>
        <button className="btn btn-primary mt-4 w-full sm:w-auto" disabled={!agreed} onClick={() => setShowRules(true)}>I agree</button>
      </section>

      {showRules && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <h2 id="rules-title" className="text-xl font-bold">Quiz rules</h2>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-surface-2 p-3"><dt className="text-xs text-muted">Questions</dt><dd className="text-2xl font-bold">{rules.questions}</dd></div>
              <div className="rounded-lg bg-surface-2 p-3"><dt className="text-xs text-muted">Minutes</dt><dd className="text-2xl font-bold">{rules.minutes}</dd></div>
              <div className="rounded-lg bg-surface-2 p-3"><dt className="text-xs text-muted">Pass mark</dt><dd className="text-2xl font-bold">{rules.passingScore}%</dd></div>
            </dl>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Questions go from easy to hard.</li>
              <li>Your answers save as you go. You can jump between questions and flag ones to revisit.</li>
              <li>The quiz submits itself when time runs out.</li>
              <li>Two attempts that don&apos;t pass lock the quiz for 24 hours.</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setShowRules(false)} disabled={pending}>Not now</button>
              <button className="btn btn-primary flex-1" disabled={pending} onClick={() => start(() => startQuiz(quizId))}>
                {pending ? "Starting…" : "Start quiz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
