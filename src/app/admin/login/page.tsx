import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentAdmin } from "@/lib/auth";
import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  if (await getCurrentAdmin()) redirect("/admin");
  return (
    <>
      <AppHeader home="/admin/login" />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">Admin sign-in</h1>
        <p className="mt-1 text-muted">For Super Admins and Local Admins.</p>
        <div className="card mt-6 p-5"><AdminLoginForm /></div>
      </main>
    </>
  );
}
