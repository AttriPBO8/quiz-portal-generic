import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { userLabel } from "@/lib/contact";
import { protectPassword } from "@/lib/passwords";
import { securityEvent } from "@/lib/security";
import { createSession } from "@/lib/session";
import { getQuizSite } from "@/lib/site";
import { enabledProviders, finishSignIn, isProvider, PROVIDER_LABEL, STATE_COOKIE, unusablePassword } from "@/lib/social-login";

// Step 2: the provider sends the person back here with a one-time code. The person is signed in
// only if the confirmed email belongs to an active user an admin created.

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const back = (error: string) => NextResponse.redirect(new URL(`/?error=${error}`, req.url));
  if (!isProvider(provider) || !enabledProviders().includes(provider)) return back("unavailable");
  const via = PROVIDER_LABEL[provider];

  const jar = await cookies();
  const saved = jar.get(STATE_COOKIE)?.value?.split(".") ?? [];
  jar.delete({ name: STATE_COOKIE, path: "/auth" });
  if (url.searchParams.get("error")) return back("cancelled");
  const [savedProvider, savedState, verifier = ""] = saved;
  const code = url.searchParams.get("code");
  if (!code || savedProvider !== provider || !savedState || savedState !== url.searchParams.get("state")) {
    await securityEvent({ type: "USER_LOGIN", success: false, portal: "quiz", detail: `${via}: missing or mismatched sign-in check (expired, or opened from another site)` });
    return back("expired");
  }

  if (!(await getQuizSite()).open) return back("closed");

  let email: string | null = null;
  try {
    email = await finishSignIn(provider, code, verifier);
  } catch {
    await securityEvent({ type: "USER_LOGIN", success: false, portal: "quiz", detail: `${via}: could not confirm the sign-in with ${via}` });
    return back("failed");
  }
  if (!email) {
    await securityEvent({ type: "USER_LOGIN", success: false, portal: "quiz", detail: `${via}: no confirmed email address` });
    return back("no_email");
  }

  const user = await db.user.findUnique({ where: { email } });
  const event = (success: boolean, detail: string) =>
    securityEvent({ type: "USER_LOGIN", success, portal: "quiz", account: user ? `user:${user.id}` : undefined, label: userLabel({ name: user?.name, email }), detail: `${via}: ${detail}` });
  if (!user || !user.active) {
    await event(false, user ? "Account is deactivated" : "No account with this email");
    return back(user ? "inactive" : "no_account");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await event(false, "Account is locked");
    return back("locked");
  }

  // Someone still on the shared starting password has now proved who they are. Switch that
  // password off so nobody else can use it for this account; they carry on with Google/Facebook,
  // and an admin can reset them to the starting password if they want a password later.
  let version = user.sessionVersion;
  if (!user.passwordChangedAt) {
    const updated = await db.user.update({
      where: { id: user.id },
      data: { ...(await protectPassword(unusablePassword())), passwordChangedAt: new Date(), failedLogins: 0, sessionVersion: { increment: 1 } },
    });
    version = updated.sessionVersion;
    await event(true, "Signed in for the first time; starting password switched off");
  } else {
    if (user.failedLogins) await db.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
    await event(true, "Signed in");
  }
  await createSession({ sub: user.id, kind: "user", ver: version });
  return NextResponse.redirect(new URL("/quizzes", req.url));
}
