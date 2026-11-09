// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { quizStatusFor, scoreAnswers, selectQuestions } from "../src/lib/quiz-engine";

const pool = (n: number, d: "EASY" | "MEDIUM" | "HARD", p: string) =>
  Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, difficulty: d }));
const counts = { EASY: 10, MEDIUM: 10, HARD: 10 };

test("picks 10 of each level in Easy, Medium, Hard order", () => {
  const ids = selectQuestions({ pool: [...pool(40, "EASY", "e"), ...pool(40, "MEDIUM", "m"), ...pool(20, "HARD", "h")], counts, seen: new Set(), isRetake: false });
  assert.equal(ids.length, 30);
  assert.equal(new Set(ids).size, 30);
  assert.ok(ids.slice(0, 10).every((id) => id.startsWith("e")));
  assert.ok(ids.slice(10, 20).every((id) => id.startsWith("m")));
  assert.ok(ids.slice(20).every((id) => id.startsWith("h")));
});

test("fills a short level from the others", () => {
  const ids = selectQuestions({ pool: [...pool(46, "EASY", "e"), ...pool(38, "MEDIUM", "m"), ...pool(4, "HARD", "h")], counts, seen: new Set(), isRetake: false });
  assert.equal(ids.length, 30);
  assert.equal(new Set(ids).size, 30);
  assert.equal(ids.filter((id) => id.startsWith("h")).length, 4);
});

test("avoids questions seen before when possible", () => {
  const all = [...pool(20, "EASY", "e"), ...pool(20, "MEDIUM", "m"), ...pool(20, "HARD", "h")];
  const first = selectQuestions({ pool: all, counts, seen: new Set(), isRetake: false });
  const second = selectQuestions({ pool: all, counts, seen: new Set(first), isRetake: true });
  assert.equal(second.filter((id) => first.includes(id)).length, 0);
  assert.ok(second.slice(20).every((id) => id.startsWith("h")));
});

test("returns fewer questions only when the bank is too small", () => {
  const ids = selectQuestions({ pool: pool(12, "EASY", "e"), counts, seen: new Set(), isRetake: false });
  assert.equal(ids.length, 12);
});

test("scores unanswered as incorrect, out of 100", () => {
  assert.deepEqual(scoreAnswers([0, 1, 2, 3], [0, 1, -1, 0]), { correctCount: 2, score: 50 });
});

test("two failed attempts in 24 hours block the quiz", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const fail = (h: number) => ({ id: String(h), status: "SUBMITTED" as const, passed: false, score: 40, submittedAt: new Date(now.getTime() - h * 3600_000), deadline: now });
  const s = quizStatusFor([fail(5), fail(1)], now);
  assert.equal(s.status, "BLOCKED");
  assert.equal(s.blockedUntil?.toISOString(), "2026-11-02T07:00:00.000Z");
  assert.equal(quizStatusFor([fail(30), fail(1)], now).status, "IN_PROGRESS");
  assert.equal(quizStatusFor([fail(5), { ...fail(1), passed: true, score: 80 }], now).status, "COMPLETED");
  assert.equal(quizStatusFor([], now).status, "ASSIGNED");
});

test("generated passwords always mix letters and digits", async () => {
  const { generatePassword } = await import("../src/lib/passwords");
  for (let i = 0; i < 200; i++) {
    const pw = generatePassword(10);
    assert.equal(pw.length, 10);
    assert.match(pw, /[A-Za-z]/);
    assert.match(pw, /[0-9]/);
  }
});
