import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminsManager } from "./AdminsManager";

export default async function Admins() {
  const me = await requireSuperAdmin();
  const admins = await db.admin.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], include: { _count: { select: { users: true, managedQuizzes: true } } } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Admins</h1>
        <p className="text-muted">Local Admins see only the users linked to them (the <code>local_admin</code> column in the users CSV) and the quizzes you give them.</p>
      </div>
      <AdminsManager
        meId={me.id}
        admins={admins.map((a) => ({ id: a.id, username: a.username, name: a.name, role: a.role === "SUPER_ADMIN" ? "Super Admin" : "Local Admin", active: a.active, users: a._count.users, quizzes: a._count.managedQuizzes }))}
      />
    </div>
  );
}
