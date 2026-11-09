import { PrismaClient } from "@prisma/client";
import { writeLog } from "./log";
import { requestInfo } from "./request-info";

const WRITES = new Set([
  "create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn",
  "upsert", "delete", "deleteMany", "$executeRaw", "$executeRawUnsafe",
]);

// Every insert, update and delete is written to the db-changes log with who made it
// (the signed-in account, or "system" for scripts). Secrets are hidden by the logger.
function createClient() {
  return new PrismaClient().$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        // SecurityEvent rows are a log already, so they are not logged twice.
        if (!WRITES.has(operation) || model === "SecurityEvent") return query(args);
        const result = await query(args);
        const { requestId, actor, ip } = await requestInfo();
        const a = args as { where?: unknown; data?: unknown; create?: unknown; update?: unknown; strings?: string[] } | undefined;
        const r = result as { id?: string; count?: number } | number | null;
        writeLog("db-changes", {
          actor: actor ?? (requestId ? "not signed in" : "system"),
          ip,
          requestId,
          table: model ?? sqlTable(a?.strings),
          operation,
          id: typeof r === "object" && r && "id" in r ? r.id : undefined,
          rows: typeof r === "number" ? r : typeof r === "object" && r && "count" in r ? r.count : 1,
          where: a?.where,
          data: Array.isArray(a?.data) ? `[${a.data.length} rows]` : (a?.data ?? (a?.create ? { create: a.create, update: a.update } : undefined)),
        });
        return result;
      },
    },
  });
}

/** Table name from a raw SQL statement such as UPDATE "Attempt" SET ... */
const sqlTable = (strings?: string[]) => strings?.join("?").match(/(?:update|into|from)\s+"?(\w+)"?/i)?.[1];

// Reuse one database connection pool across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();
export type Db = typeof db;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** The same logged client, typed as a plain PrismaClient for helpers shared with the scripts. */
export const dbForImports = db as unknown as PrismaClient;
