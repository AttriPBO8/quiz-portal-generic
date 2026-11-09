import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, userScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { filterOptions } from "@/lib/reports";
import { UserForm } from "../UserForm";

export default async function EditUser({ params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin();
  const { userId } = await params;
  const user = await db.user.findFirst({ where: { id: userId, ...userScope(admin) } });
  if (!user) notFound();
  const isSuper = admin.role === "SUPER_ADMIN";
  const [opts, localAdmins] = await Promise.all([
    filterOptions(admin),
    isSuper ? db.admin.findMany({ where: { role: "LOCAL_ADMIN" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/admin/users" className="text-sm text-primary underline">← Users</Link>
      <h1 className="text-2xl font-bold">Edit {user.name}</h1>
      <p className="text-muted">Changing the email or phone number signs the user out on every device. Their password stays the same.</p>
      <div className="card p-5">
        <UserForm
          user={{ id: user.id, name: user.name, email: user.email ?? "", phone: user.phone ?? "", role: user.role, group: user.group, testAccount: user.testAccount, localAdminId: user.localAdminId ?? "" }}
          roles={opts.roles} groups={opts.groups}
          localAdmins={isSuper ? localAdmins.map((a) => ({ id: a.id, name: a.name })) : undefined}
        />
      </div>
    </div>
  );
}
