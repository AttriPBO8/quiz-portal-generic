import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/auth";
import { getQuizSite } from "@/lib/site";
import { enabledProviders, PROVIDER_LABEL } from "@/lib/social-login";
import { LoginForm } from "./LoginForm";

// Messages for problems coming back from "Continue with Google / Facebook".
const SOCIAL_ERRORS: Record<string, string> = {
  no_account: "That email address isn't registered here. Ask your admin to add it, or sign in with your phone number and password.",
  inactive: "This account has been switched off. Ask your admin.",
  locked: "Too many wrong passwords. Try again in 15 minutes, or ask your admin to reset it.",
  no_email: "We didn't get a confirmed email address. Allow access to your email and try again, or sign in with your password.",
  cancelled: "Sign-in was cancelled.",
  expired: "That sign-in took too long or was opened from another page. Please try again.",
  failed: "We couldn't complete the sign-in. Please try again, or sign in with your password.",
  closed: "The quiz site is closed.",
  unavailable: "That sign-in option isn't available.",
};

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/quizzes");
  const site = await getQuizSite();
  if (!site.open) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
          <h1 className="text-2xl font-bold">The quiz site is closed</h1>
          <p className="card mt-6 p-5 sm:p-6">{site.message}</p>
          <p className="mt-6 text-center text-sm text-muted"><Link href="/admin/login" className="underline">Admin sign-in</Link></p>
        </main>
      </>
    );
  }
  const providers = enabledProviders();
  const socialError = SOCIAL_ERRORS[(await searchParams).error ?? ""];
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Sign in to take your quiz</h1>
        <p className="mt-1 text-muted">Use the email address or phone number your admin registered for you.</p>
        <div className="card mt-6 p-5 sm:p-6">
          {socialError && <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{socialError}</p>}
          {providers.length > 0 && (
            <>
              <div className="space-y-3">
                {providers.map((p) => (
                  // A plain link: the browser goes to Google or Facebook and comes back signed in.
                  <a key={p} href={`/auth/${p}/start`} className="btn btn-secondary w-full">Continue with {PROVIDER_LABEL[p]}</a>
                ))}
              </div>
              <p className="my-4 flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></p>
            </>
          )}
          <LoginForm />
        </div>
        {providers.length > 0 && <p className="mt-3 text-center text-sm text-muted">Google and Facebook work only with the email address your admin registered.</p>}
        <p className="mt-6 text-center text-sm text-muted">
          Forgot your password? Ask your admin to reset it.
          <br />
          <Link href="/admin/login" className="underline">Admin sign-in</Link>
        </p>
      </main>
    </>
  );
}
