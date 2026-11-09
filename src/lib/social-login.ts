import "server-only";
import { randomBytes } from "node:crypto";
import { Facebook, Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { normalizeEmail } from "./contact";

// "Continue with Google" and "Continue with Facebook" for quiz-takers.
//
// Nobody can sign themselves up this way: the email address Google or Facebook confirms must
// already belong to a user an admin created. Phone-only users keep using their password.
// Each provider is on only when its two settings are present, so every customer can choose.

export type Provider = "google" | "facebook";
export const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", facebook: "Facebook" };

const settings = {
  google: { id: () => process.env.GOOGLE_CLIENT_ID, secret: () => process.env.GOOGLE_CLIENT_SECRET },
  facebook: { id: () => process.env.FACEBOOK_CLIENT_ID, secret: () => process.env.FACEBOOK_CLIENT_SECRET },
};

/** The app's public address, e.g. https://quiz.acme.com. Needed to build the return address. */
const appUrl = () => (process.env.APP_URL ?? "").replace(/\/+$/, "");

export const isProvider = (p: string): p is Provider => p === "google" || p === "facebook";

export function enabledProviders(): Provider[] {
  if (!appUrl()) return [];
  return (Object.keys(settings) as Provider[]).filter((p) => settings[p].id() && settings[p].secret());
}

/** The address Google or Facebook sends people back to. Register exactly this in their console. */
export const callbackUrl = (p: Provider) => `${appUrl()}/auth/${p}/callback`;

function client(p: Provider) {
  const id = settings[p].id()!;
  const secret = settings[p].secret()!;
  return p === "google" ? new Google(id, secret, callbackUrl(p)) : new Facebook(id, secret, callbackUrl(p));
}

/** Where to send the browser, plus the one-time values to keep in a short-lived cookie. */
export function startSignIn(p: Provider) {
  const state = generateState();
  if (p === "google") {
    const verifier = generateCodeVerifier();
    const url = (client(p) as Google).createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
    url.searchParams.set("prompt", "select_account");
    return { url, state, verifier };
  }
  const url = (client(p) as Facebook).createAuthorizationURL(state, ["email"]);
  return { url, state, verifier: "" };
}

/**
 * Swaps the one-time code for the person's confirmed email address.
 * Returns null when the provider did not give a confirmed email.
 */
export async function finishSignIn(p: Provider, code: string, verifier: string): Promise<string | null> {
  if (p === "google") {
    const tokens = await (client(p) as Google).validateAuthorizationCode(code, verifier);
    // The ID token comes straight from Google's token endpoint over HTTPS, so its claims can be trusted.
    const claims = decodeIdToken(tokens.idToken()) as { email?: string; email_verified?: boolean };
    return claims.email && claims.email_verified ? normalizeEmail(claims.email) : null;
  }
  const tokens = await (client(p) as Facebook).validateAuthorizationCode(code);
  const res = await fetch("https://graph.facebook.com/v21.0/me?fields=id,email", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  // Facebook only returns an email address the person has confirmed.
  const me = (await res.json()) as { email?: string };
  return me.email ? normalizeEmail(me.email) : null;
}

/** A random password nobody knows, used to switch off the shared starting password. */
export const unusablePassword = () => randomBytes(32).toString("base64url");

export const STATE_COOKIE = "qp_oauth";
