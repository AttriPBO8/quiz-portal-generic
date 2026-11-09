import { headers } from "next/headers";

// Details the middleware attaches to every request (see src/middleware.ts).
// Outside a request (scripts, seed) these are empty.
export type RequestInfo = { requestId?: string; ip?: string; userAgent?: string; actor?: string };

export async function requestInfo(): Promise<RequestInfo> {
  try {
    const h = await headers();
    return {
      requestId: h.get("x-request-id") ?? undefined,
      ip: h.get("x-client-ip") ?? undefined,
      userAgent: h.get("user-agent")?.slice(0, 200) ?? undefined,
      actor: h.get("x-actor") ?? undefined,
    };
  } catch {
    return {};
  }
}
