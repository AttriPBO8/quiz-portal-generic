import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getQuizSite } from "@/lib/site";
import { enabledProviders, isProvider, startSignIn, STATE_COOKIE } from "@/lib/social-login";

// Step 1 of "Continue with Google / Facebook": remember a one-time value, then go to the provider.

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const home = new URL("/", req.url);
  if (!isProvider(provider) || !enabledProviders().includes(provider)) return NextResponse.redirect(home);
  if (!(await getQuizSite()).open) return NextResponse.redirect(home);

  const { url, state, verifier } = startSignIn(provider);
  (await cookies()).set(STATE_COOKIE, `${provider}.${state}.${verifier}`, {
    httpOnly: true, secure: env.isProduction, sameSite: "lax", path: "/auth", maxAge: 600,
  });
  return NextResponse.redirect(url);
}
