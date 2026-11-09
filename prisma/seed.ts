// Loads sample data for development and testing: run `npm run db:seed`.
// Safe to run more than once; existing rows are updated, not duplicated.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { parseCsv } from "../src/lib/csv";
import { importQuestions, importUsers } from "../src/lib/importers";
import { hashPassword } from "../src/lib/passwords";
import { detectMedia, saveMedia } from "../src/lib/media-storage";

const db = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const userPassword = process.env.DEFAULT_USER_PASSWORD;
  if (!adminPassword || !userPassword) throw new Error("Run `npm run setup` first to create .env.");
  const passwordHash = await hashPassword(adminPassword);

  await db.admin.upsert({
    where: { username: "superadmin" },
    update: {},
    create: { username: "superadmin", name: "Super Admin", role: "SUPER_ADMIN", passwordHash },
  });
  for (let d = 1; d <= 3; d++) {
    await db.admin.upsert({
      where: { username: `localadmin${d}` },
      update: {},
      create: { username: `localadmin${d}`, name: `Local Admin ${d}`, role: "LOCAL_ADMIN", passwordHash },
    });
  }

  const users = await importUsers(db, parseCsv(readFileSync("data/sample-users.csv", "utf8")), userPassword);
  console.log("Users:", users.created, "created,", users.updated, "updated,", users.errors.length, "errors");

  // Sample pictures, sounds and videos, saved the same way an admin upload is.
  const mediaList: { file: string; altText: string }[] = JSON.parse(readFileSync("data/sample-media/media.json", "utf8"));
  for (const m of mediaList) {
    if (await db.mediaFile.findUnique({ where: { name: m.file } })) continue;
    const body = new Uint8Array(readFileSync(`data/sample-media/${m.file}`));
    const type = detectMedia(body);
    if (!type) throw new Error(`Not a supported media file: ${m.file}`);
    const storageKey = `media/${randomUUID()}.${type.ext}`;
    await saveMedia(storageKey, body, type.mimeType);
    await db.mediaFile.create({ data: { name: m.file, kind: type.kind, mimeType: type.mimeType, size: body.length, altText: m.altText, storageKey, uploadedBy: "seed" } });
  }
  console.log("Media files:", await db.mediaFile.count());

  for (const [bankName, file] of [["General Knowledge", "data/sample-questions.json"], ["Mathematics", "data/sample-questions-math.json"], ["Pictures, Sound and Video", "data/sample-questions-media.json"]]) {
    const r = await importQuestions(db, bankName, JSON.parse(readFileSync(file, "utf8")));
    console.log(`Questions (${bankName}):`, r.created, "created,", r.updated, "updated,", r.errors.length, "errors");
  }

  // Four sample quizzes, each assigned to every user, so testers have a few to try.
  const sampleQuizzes = [
    { title: "Topic A - Sample Text", bank: "General Knowledge" },
    { title: "Mathematics Basics", bank: "Mathematics", numEasy: 5, numMedium: 5, numHard: 5, timeLimitMinutes: 15 },
    { title: "Quick Practice (6 questions)", bank: "General Knowledge", numEasy: 2, numMedium: 2, numHard: 2, timeLimitMinutes: 5, passingScore: 50 },
    { title: "Pictures, Sound and Video (sample)", bank: "Pictures, Sound and Video", numEasy: 2, numMedium: 2, numHard: 2, timeLimitMinutes: 10, passingScore: 50 },
  ];
  const localAdmins = await db.admin.findMany({ where: { role: "LOCAL_ADMIN" } });
  const allUsers = await db.user.findMany({ select: { id: true } });
  for (const { bank: bankName, ...settings } of sampleQuizzes) {
    const bank = await db.questionBank.findUniqueOrThrow({ where: { name: bankName } });
    let quiz = await db.quiz.findFirst({ where: { title: settings.title } });
    if (!quiz) quiz = await db.quiz.create({ data: { ...settings, bankId: bank.id } });
    await db.quizManager.createMany({ data: localAdmins.map((a) => ({ quizId: quiz.id, adminId: a.id })), skipDuplicates: true });
    await db.assignment.createMany({ data: allUsers.map((u) => ({ quizId: quiz.id, userId: u.id })), skipDuplicates: true });
    console.log(`Quiz "${quiz.title}" assigned to ${allUsers.length} users.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
