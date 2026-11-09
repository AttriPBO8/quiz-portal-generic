import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
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
  const districts = await db.district.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, blocks: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Sign in to take your quiz</h1>
        <p className="mt-1 text-muted">Choose where you work, then enter your phone number and password.</p>
        <div className="card mt-6 p-5 sm:p-6">
          <LoginForm districts={districts} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Forgot your password? Ask your Local Admin to reset it.
          <br />
          <Link href="/admin/login" className="underline">Admin sign-in</Link>
        </p>
      </main>
    </>
  );
}
