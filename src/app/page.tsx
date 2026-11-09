import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/auth";
import { getQuizSite } from "@/lib/site";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function Home() {
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
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Sign in to take your quiz</h1>
        <p className="mt-1 text-muted">Use the email address or phone number your admin registered for you.</p>
        <div className="card mt-6 p-5 sm:p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Forgot your password? Ask your admin to reset it.
          <br />
          <Link href="/admin/login" className="underline">Admin sign-in</Link>
        </p>
      </main>
    </>
  );
}
