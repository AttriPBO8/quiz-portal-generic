import { AppHeader, initials } from "@/components/AppHeader";
import { UserMenu } from "@/components/UserMenu";
import { logoutAdmin } from "@/app/actions/admin-auth";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const isSuper = admin.role === "SUPER_ADMIN";
  const links = [
    { href: "/admin", label: "Results" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/quizzes", label: "Quizzes" },
    ...(isSuper ? [{ href: "/admin/questions", label: "Question banks" }, { href: "/admin/admins", label: "Admins" }, { href: "/admin/site", label: "Quiz site" }, { href: "/admin/security", label: "Security log" }] : []),
  ];
  return (
    <>
      <AppHeader
        home="/admin"
        right={
          <UserMenu
            name={admin.name}
            initials={initials(admin.name)}
            detail={`${isSuper ? "Super Admin" : "Local Admin"} · ${admin.username}`}
            links={[{ href: "/admin/password", label: "Change password" }]}
            onSignOut={logoutAdmin}
          />
        }
      />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-6">
        <AdminNav links={links} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
