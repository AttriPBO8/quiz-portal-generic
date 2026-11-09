// Creates a Super Admin (or Local Admin) account with a random password. Use it once on a new
// database, e.g. the AWS one:   npm run create-admin -- yourname "Your Name"
// Add "--local" at the end for a Local Admin.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generatePassword, hashPassword } from "../src/lib/passwords";

const [username, name, flag] = process.argv.slice(2);
if (!username || !name) {
  console.log('Usage: npm run create-admin -- <username> "<Full Name>" [--local]');
  process.exit(1);
}
const db = new PrismaClient();
(async () => {
  const password = generatePassword(14);
  const role = flag === "--local" ? "LOCAL_ADMIN" : "SUPER_ADMIN";
  await db.admin.create({ data: { username: username.toLowerCase(), name, role, passwordHash: await hashPassword(password) } });
  console.log(`Created ${role === "SUPER_ADMIN" ? "Super Admin" : "Local Admin"} "${username}". Password: ${password}`);
  console.log("Sign in at /admin/login and change it under the account menu.");
  await db.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
