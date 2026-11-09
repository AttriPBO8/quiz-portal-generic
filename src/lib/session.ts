import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

// Sessions are signed tokens kept in an httpOnly cookie, so page scripts cannot read them.
// Each token carries the account's sessionVersion; bumping it (password change, logout
// everywhere, deactivation) makes older tokens stop working.

export type SessionKind = "user" | "admin";
export type SessionPayload = { sub: string; kind: SessionKind; ver: number };

const COOKIE = { user: "qp_user", admin: "qp_admin" } as const;
const MAX_AGE_SECONDS = 8 * 60 * 60;

const key = () => new TextEncoder().encode(env.sessionSecret);

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ kind: payload.kind, ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());
  const jar = await cookies();
  jar.set(COOKIE[payload.kind], token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(kind: SessionKind): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE[kind])?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.kind !== kind || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, kind, ver: Number(payload.ver ?? 0) };
  } catch {
    return null;
  }
}

export async function clearSession(kind: SessionKind) {
  (await cookies()).delete(COOKIE[kind]);
}
