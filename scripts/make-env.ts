// Local setup:   npm run setup -- <your PostgreSQL password>
//   Creates .env with fresh random secrets and prints the test passwords.
// For AWS:       npm run setup -- --print
//   Prints a fresh set of secrets to paste into Amplify, without touching .env.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { generatePassword } from "../src/lib/passwords";

const arg = process.argv[2] ?? "postgres";
const secrets = [
  `SESSION_SECRET="${randomBytes(48).toString("base64url")}"`,
  `DEFAULT_USER_PASSWORD="${generatePassword(10)}"`,
];

if (arg === "--print") {
  console.log("Paste these into Amplify > Hosting > Environment variables (without the quotes).");
  console.log("");
  console.log(secrets.join("\n"));
  process.exit(0);
}

if (existsSync(".env") && readFileSync(".env", "utf8").includes("SESSION_SECRET")) {
  console.log(".env already exists; nothing changed. Delete it first to start over.");
  process.exit(0);
}
const lines = [
  "# Local settings. Never commit or share this file. See .env.example for what each one means.",
  `DATABASE_URL="postgresql://postgres:${encodeURIComponent(arg)}@localhost:5432/quizportal?connection_limit=10"`,
  ...secrets,
  `SEED_ADMIN_PASSWORD="${generatePassword(14)}"`,
];
writeFileSync(".env", lines.join("\n") + "\n");
console.log("Created .env. Your test passwords (also saved in .env):");
console.log(lines.slice(4).join("\n"));
