import type { Difficulty } from "@prisma/client";
import { BLOCK_HOURS, MAX_FAILED_ATTEMPTS } from "./constants";

// Pure quiz rules (no database access), so they are easy to test.

type PoolQuestion = { id: string; difficulty: Difficulty };
const LEVELS: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks the questions for a new attempt.
 * - Takes the requested number at each difficulty, at random.
 * - Prefers questions the person has not seen in earlier attempts of this quiz.
 * - If a level runs short, fills the gap from the other levels.
 * - First attempt: Easy, then Medium, then Hard. Retake: Easy and Medium mixed, Hard last.
 */
export function selectQuestions(opts: {
  pool: PoolQuestion[];
  counts: Record<Difficulty, number>;
  seen: Set<string>;
  isRetake: boolean;
  random?: () => number;
}): string[] {
  const random = opts.random ?? Math.random;
  const ordered = (list: PoolQuestion[]) => [
    ...shuffle(list.filter((q) => !opts.seen.has(q.id)), random),
    ...shuffle(list.filter((q) => opts.seen.has(q.id)), random),
  ];

  const picked: Record<Difficulty, PoolQuestion[]> = { EASY: [], MEDIUM: [], HARD: [] };
  const leftovers: PoolQuestion[] = [];
  let shortfall = 0;
  for (const level of LEVELS) {
    const candidates = ordered(opts.pool.filter((q) => q.difficulty === level));
    const want = opts.counts[level];
    picked[level] = candidates.slice(0, want);
    leftovers.push(...candidates.slice(want));
    shortfall += Math.max(0, want - candidates.length);
  }
  // Fill any gap with unused questions from other levels, unseen ones first.
  for (const q of ordered(leftovers).slice(0, shortfall)) picked[q.difficulty].push(q);

  const ids = (l: PoolQuestion[]) => l.map((q) => q.id);
  if (opts.isRetake) {
    return [...ids(shuffle([...picked.EASY, ...picked.MEDIUM], random)), ...ids(picked.HARD)];
  }
  return [...ids(picked.EASY), ...ids(picked.MEDIUM), ...ids(picked.HARD)];
}

/** Score out of 100, rounded. Unanswered (-1) counts as incorrect. */
export function scoreAnswers(correct: number[], answers: number[]) {
  const correctCount = correct.reduce((n, c, i) => n + (answers[i] === c ? 1 : 0), 0);
  const score = correct.length ? Math.round((correctCount / correct.length) * 100) : 0;
  return { correctCount, score };
}

export type QuizStatus = "ASSIGNED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";

type AttemptSummary = {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED";
  passed: boolean | null;
  score: number | null;
  submittedAt: Date | null;
  deadline: Date;
};

/** Works out where a quiz sits on the person's dashboard. */
export function quizStatusFor(attempts: AttemptSummary[], now = new Date()) {
  const submitted = attempts.filter((a) => a.status === "SUBMITTED");
  const best = submitted.reduce<number | null>((m, a) => Math.max(m ?? 0, a.score ?? 0), null);
  const open = attempts.find((a) => a.status === "IN_PROGRESS");

  if (submitted.some((a) => a.passed)) return { status: "COMPLETED" as QuizStatus, best };
  if (open) return { status: "IN_PROGRESS" as QuizStatus, best, openAttemptId: open.id, openExpired: open.deadline <= now };

  const windowStart = now.getTime() - BLOCK_HOURS * 3600_000;
  const recentFails = submitted
    .filter((a) => a.passed === false && a.submittedAt && a.submittedAt.getTime() > windowStart)
    .map((a) => a.submittedAt!.getTime())
    .sort((x, y) => y - x);
  if (recentFails.length >= MAX_FAILED_ATTEMPTS) {
    const unlock = recentFails[MAX_FAILED_ATTEMPTS - 1] + BLOCK_HOURS * 3600_000;
    return { status: "BLOCKED" as QuizStatus, best, blockedUntil: new Date(unlock) };
  }
  return { status: (submitted.length ? "IN_PROGRESS" : "ASSIGNED") as QuizStatus, best };
}

/** Whether the quiz is inside its open/close dates. */
export function quizWindow(quiz: { opensAt: Date | null; closesAt: Date | null }, now = new Date()) {
  if (quiz.opensAt && now < quiz.opensAt) return "NOT_OPEN" as const;
  if (quiz.closesAt && now > quiz.closesAt) return "CLOSED" as const;
  return "OPEN" as const;
}
