import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { writeLog } from "@/lib/log";
import { RateLimiter } from "@/lib/rate-limit";

// Runs before every page, action and download (not before static files). It:
//  1. refuses oversized requests, unusual methods and floods from one address (HTTP 413/405/429);
//  2. writes one line per request to the quiz-access or admin-access log;
//  3. tags the request with an id, the caller's address and the signed-in account, so the
//     security and db-changes logs can name who did what.

const perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE) || 1200;
// Generous, because a whole training centre may share one internet address.
const requests = new RateLimiter(perMinute, 60_000);
const quizSignIns = new RateLimiter(100, 10 * 60_000);
const adminSignIns = new RateLimiter(30, 10 * 60_000);

const MAX_BODY_BYTES = 7 * 1024 * 1024;
const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

function clientIp(req: NextRequest) {
  const viewer = req.headers.get("cloudfront-viewer-address");
  if (viewer) return viewer.replace(/:\d+$/, "");
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

async function signedInAs(req: NextRequest, admin: boolean) {
  const token = req.cookies.get(admin ? "qp_admin" : "qp_user")?.value;
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return `${admin ? "admin" : "user"}:${payload.sub}`;
  } catch {
    return "invalid-session";
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const admin = path.startsWith("/admin");
  const ip = clientIp(req);
  const requestId = crypto.randomUUID();
  const actor = await signedInAs(req, admin);
  const isAction = req.method === "POST" && req.headers.has("next-action");
  const entry = { requestId, ip, method: req.method, path, action: isAction || undefined, actor, userAgent: req.headers.get("user-agent")?.slice(0, 200) };

  const refuse = (status: number, reason: string, retryAfter?: number) => {
    writeLog(admin ? "admin-access" : "quiz-access", { ...entry, status });
    writeLog("security", { type: "REQUEST_BLOCKED", success: false, portal: admin ? "admin" : "quiz", reason, ...entry });
    return new NextResponse(status === 429 ? "Too many requests. Please wait a moment and try again." : reason, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
    });
  };

  if (!["GET", "HEAD", "POST"].includes(req.method)) return refuse(405, "Method not allowed");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return refuse(413, "Request too large");
  const wait = requests.hit(ip);
  if (wait) return refuse(429, "Too many requests from this address", wait);
  if (isAction && (path === "/" || path === "/admin/login")) {
    const loginWait = (admin ? adminSignIns : quizSignIns).hit(ip);
    if (loginWait) return refuse(429, "Too many sign-in attempts from this address", loginWait);
  }

  // Pass the details on to the app. Values a browser sent under these names are overwritten.
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-client-ip", ip);
  if (actor) headers.set("x-actor", actor);
  else headers.delete("x-actor");
  const res = NextResponse.next({ request: { headers } });
  writeLog(admin ? "admin-access" : "quiz-access", entry);
  return res;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|signatures/).*)"],
};
