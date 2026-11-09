// Load test for a LOCAL copy only: `npm run build`, then start the app with the per-address limit
// raised (every simulated person shares one address): `set RATE_LIMIT_PER_MINUTE=1000000 && npm start`
// (Windows) or `RATE_LIMIT_PER_MINUTE=1000000 npm start`, then in another terminal
//   npx tsx scripts/load-test.ts 500
// N simulated quiz-takers open the quiz page and save 30 answers each, all at the same moment.
// It creates its own attempts (marked "load-test") and removes them at the end.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { selectQuestions } from "../src/lib/quiz-engine";

const N = Number(process.argv[2] ?? 500);
const BASE = process.env.LOAD_TEST_URL ?? "http://localhost:3000";
const MARK = "load-test";
const db = new PrismaClient();

if (!/localhost|127\.0\.0\.1/.test(BASE) || !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("The load test only runs against a local server and database.");
}

const pct = (arr: number[], p: number) => Math.round([...arr].sort((x, y) => x - y)[Math.floor(arr.length * p)] ?? 0);

async function main() {
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  const action = Object.entries(manifest.node as Record<string, { exportedName?: string }>).find(([, v]) => v.exportedName === "saveAnswer")?.[0];
  if (!action) throw new Error("Run `npm run build` first.");

  const quiz = await db.quiz.findFirstOrThrow({ where: { active: true } });
  const pool = await db.question.findMany({ where: { bankId: quiz.bankId, active: true }, select: { id: true, difficulty: true } });
  const users = await db.user.findMany({ where: { active: true, attempts: { none: { status: "IN_PROGRESS" } } }, take: N });
  const attempts: { id: string }[] = [];
  for (const u of users) {
    const questionIds = selectQuestions({ pool, counts: { EASY: quiz.numEasy, MEDIUM: quiz.numMedium, HARD: quiz.numHard }, seen: new Set(), isRetake: false });
    attempts.push(await db.attempt.create({
      data: { userId: u.id, quizId: quiz.id, deadline: new Date(Date.now() + 3600_000), questionIds, answers: questionIds.map(() => -1), flagged: [], userAgent: MARK },
      select: { id: true },
    }));
  }
  const key = new TextEncoder().encode(process.env.SESSION_SECRET!);
  const cookies = await Promise.all(users.map((u) =>
    new SignJWT({ kind: "user", ver: u.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setExpirationTime("1h").sign(key)));

  const pageTimes: number[] = [], saveTimes: number[] = [];
  let errors = 0;
  const visitor = async (i: number) => {
    const a = attempts[i % attempts.length];
    const headers = { cookie: `qp_user=${cookies[i % cookies.length]}` };
    let t = performance.now();
    const r = await fetch(`${BASE}/attempt/${a.id}`, { headers });
    await r.text();
    pageTimes.push(performance.now() - t);
    if (r.status !== 200) errors++;
    for (let q = 0; q < 30; q++) {
      t = performance.now();
      const s = await fetch(`${BASE}/attempt/${a.id}`, {
        method: "POST",
        headers: { ...headers, "Next-Action": action, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
        body: JSON.stringify([a.id, q, q % 4]),
      });
      const body = await s.text();
      saveTimes.push(performance.now() - t);
      if (s.status !== 200 || !body.includes("true")) errors++;
    }
  };

  const start = performance.now();
  await Promise.all(Array.from({ length: N }, (_, i) => visitor(i)));
  const secs = (performance.now() - start) / 1000;
  console.log(`${N} quiz-takers at once (${users.length} distinct accounts): ${pageTimes.length} page loads, ${saveTimes.length} answer saves in ${secs.toFixed(1)}s, ${errors} errors`);
  console.log(`Quiz page:   median ${pct(pageTimes, 0.5)} ms, 95% under ${pct(pageTimes, 0.95)} ms`);
  console.log(`Answer save: median ${pct(saveTimes, 0.5)} ms, 95% under ${pct(saveTimes, 0.95)} ms (${Math.round(saveTimes.length / secs)} saves/s)`);

  await db.attempt.deleteMany({ where: { userAgent: MARK } });
  await db.$disconnect();
}
main();
