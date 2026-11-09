import { UserHeader } from "@/components/UserHeader";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "@/components/PasswordForm";
import { changeUserPassword } from "@/app/actions/user-auth";

export const dynamic = "force-dynamic";

export default async function ChangePassword() {
  const user = await requireUser({ allowStartingPassword: true });
  const firstTime = !user.passwordChangedAt;
  return (
    <>
      <UserHeader user={user} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">{firstTime ? "Set your own password" : "Change password"}</h1>
        <p className="mt-1 text-muted">
          {firstTime
            ? "Before you start, replace the starting password with one only you know. "
            : "Other devices will be signed out. "}
          Use at least 8 characters with letters and numbers.
        </p>
        <div className="card mt-6 p-5">
          <PasswordForm action={changeUserPassword} backHref={firstTime ? undefined : "/quizzes"} currentLabel={firstTime ? "Starting password" : undefined} />
        </div>
      </main>
    </>
  );
}
